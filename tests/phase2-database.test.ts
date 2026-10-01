import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { handleRedirect } from "../src/features/redirect/service";
import { isGoogleReviewUrl } from "../src/lib/validation/google-review-url";
import type { Summary } from "../src/features/analytics/repository";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
type DbEndpoint = {
  id: string;
  type: "nfc" | "qr";
  short_code: string;
  destination_url: string;
};
test("Phase 2 migration, permissions, redirect and aggregation", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
   create role anon nologin;create role authenticated nologin;create role service_role nologin;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
   alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;
  `);
    for (const migration of [
      "20260929000000_phase1_foundation.sql",
      "20260930000000_phase2_acquisition.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
    await db.exec(`insert into auth.users values('${USER_A}'),('${USER_B}');`);
    async function asUser(id = USER_A) {
      await db.exec(
        `reset role;set role authenticated;set request.jwt.claim.sub='${id}';`,
      );
    }
    async function admin(sql: string) {
      await db.exec("reset role");
      return db.exec(sql);
    }
    async function createStore(name: string) {
      const r = await db.query<{ id: string }>(
        `select public.create_store($1,'Tokyo','https://g.page/r/ChIJ_test/review') as id`,
        [name],
      );
      return r.rows[0].id;
    }
    await asUser();
    const storeA = await createStore("A");
    const create = await db.query<{ id: string }>(
      "select public.create_acquisition_asset($1,$2) as id",
      [storeA, "Counter"],
    );
    const assetA = create.rows[0].id;
    const endpoints = (
      await db.query<DbEndpoint>(
        "select * from public.acquisition_endpoints order by type",
      )
    ).rows;
    const nfc = endpoints.find((e) => e.type === "nfc")!;
    const qr = endpoints.find((e) => e.type === "qr")!;
    await asUser(USER_B);
    const storeB = await createStore("B");
    const assetB = (
      await db.query<{ id: string }>(
        "select public.create_acquisition_asset($1,$2) as id",
        [storeB, "B Counter"],
      )
    ).rows[0].id;
    async function resolve(
      type: string,
      shortCode: string,
      userAgent: string | null = "Test client",
    ) {
      await db.exec("reset role;set role service_role");
      const r = await db.query<{ url: string | null }>(
        "select public.resolve_and_log_redirect($1,$2,$3) as url",
        [type, shortCode, userAgent],
      );
      return r.rows[0].url;
    }
    async function response(type: string, shortCode: string) {
      return handleRedirect(
        { type, shortCode, userAgent: null },
        { resolveAndLog: (i) => resolve(i.type, i.shortCode, i.userAgent) },
      );
    }
    async function logCount() {
      await db.exec("reset role");
      return (
        await db.query<{ n: number }>(
          "select count(*)::int as n from public.access_logs",
        )
      ).rows[0].n;
    }

    await t.test(
      "creates one asset with distinct unpredictable NFC and QR endpoints",
      async () => {
        assert.equal(endpoints.length, 2);
        assert.notEqual(nfc.short_code, qr.short_code);
        for (const e of endpoints) {
          assert.match(e.short_code, /^[a-f0-9]{32}$/);
          assert.equal(e.destination_url, "https://g.page/r/ChIJ_test/review");
        }
      },
    );
    await t.test(
      "NFC and QR produce 302 to the correct destination and persist coherent logs",
      async () => {
        for (const e of [nfc, qr]) {
          const result = await response(e.type, e.short_code);
          assert.equal(result.status, 302);
          assert.equal(result.headers.get("location"), e.destination_url);
          assert.match(result.headers.get("cache-control")!, /no-store/);
        }
        await db.exec("reset role");
        const logs = (
          await db.query<{
            store_id: string;
            acquisition_asset_id: string;
            access_method: string;
            ip_hash: null;
            redirected_at: string;
            accessed_at: string;
          }>("select * from public.access_logs order by accessed_at")
        ).rows;
        assert.equal(logs.length, 2);
        assert.deepEqual(
          logs.map((l) => l.access_method),
          ["nfc", "qr"],
        );
        for (const l of logs) {
          assert.equal(l.store_id, storeA);
          assert.equal(l.acquisition_asset_id, assetA);
          assert.equal(l.ip_hash, null);
          assert.ok(l.redirected_at >= l.accessed_at);
        }
      },
    );
    await t.test(
      "wrong type, missing and malformed codes are rejected without logs",
      async () => {
        const before = await logCount();
        for (const [type, code] of [
          ["nfc", qr.short_code],
          ["qr", nfc.short_code],
          ["qr", "0".repeat(32)],
          ["nfc", "bad"],
          ["email", nfc.short_code],
        ])
          assert.equal((await response(type, code)).status, 404);
        assert.equal(await logCount(), before);
      },
    );
    await t.test(
      "inactive endpoint, asset and store all reject access",
      async () => {
        const before = await logCount();
        for (const [table, id] of [
          ["acquisition_endpoints", nfc.id],
          ["acquisition_assets", assetA],
          ["stores", storeA],
        ]) {
          await admin(
            `update public.${table} set status='inactive' where id='${id}'`,
          );
          assert.equal((await response("nfc", nfc.short_code)).status, 404);
          if (table !== "acquisition_endpoints")
            assert.equal((await response("qr", qr.short_code)).status, 404);
          await admin(
            `update public.${table} set status='active' where id='${id}'`,
          );
        }
        assert.equal(await logCount(), before);
      },
    );
    await t.test(
      "store destination edit updates both endpoints without rotating short codes",
      async () => {
        await asUser();
        await db.query(
          "update public.stores set google_review_url=$1 where id=$2",
          [
            "https://search.google.com/local/writereview?placeid=NewPlace",
            storeA,
          ],
        );
        assert.equal(
          await resolve("nfc", nfc.short_code),
          "https://search.google.com/local/writereview?placeid=NewPlace",
        );
        assert.equal(
          await resolve("qr", qr.short_code),
          "https://search.google.com/local/writereview?placeid=NewPlace",
        );
      },
    );
    await t.test(
      "RLS blocks all cross-store reads and mutations including aggregates and RPC creation",
      async () => {
        await asUser(USER_B);
        for (const [table, column, id] of [
          ["acquisition_assets", "id", assetA],
          ["acquisition_endpoints", "acquisition_asset_id", assetA],
          ["access_logs", "store_id", storeA],
        ])
          assert.equal(
            (
              await db.query(
                `select * from public.${table} where ${column}=$1`,
                [id],
              )
            ).rows.length,
            0,
          );
        assert.equal(
          (
            await db.query(
              "update public.acquisition_assets set name='Hacked' where id=$1 returning id",
              [assetA],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "update public.acquisition_endpoints set status='inactive' where id=$1 returning id",
              [nfc.id],
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.create_acquisition_asset($1,$2)", [
            storeA,
            "Forbidden",
          ]),
          /Store not available/,
        );
        assert.equal(
          (
            await db.query("select * from public.asset_access_counts($1)", [
              [assetA],
            ])
          ).rows.length,
          0,
        );
        const summary = (
          await db.query<{ s: Summary }>(
            "select public.access_summary(now()-interval '30 days',now(),$1) as s",
            [storeA],
          )
        ).rows[0].s;
        assert.equal(summary.totals.total, 0);
        assert.deepEqual(summary.assets, []);
        assert.deepEqual(summary.stores, []);
        await assert.rejects(
          db.query(
            "insert into public.acquisition_assets(store_id,name) values($1,$2)",
            [storeA, "Bypass"],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.exec("update public.access_logs set ip_hash=null"),
          /permission denied/,
        );
        await assert.rejects(
          db.exec("delete from public.access_logs"),
          /permission denied/,
        );
        await assert.rejects(
          db.exec("insert into public.access_logs default values"),
          /permission denied/,
        );
        await assert.rejects(
          db.query(
            "update public.acquisition_assets set store_id=$1 where id=$2",
            [storeA, assetB],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query(
            "update public.acquisition_endpoints set destination_url=$1",
            ["https://g.page/evil/review"],
          ),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select public.resolve_and_log_redirect($1,$2)", [
            "nfc",
            nfc.short_code,
          ]),
          /permission denied/,
        );
        await db.exec("reset role;set role anon");
        for (const table of [
          "acquisition_assets",
          "acquisition_endpoints",
          "access_logs",
        ])
          await assert.rejects(
            db.query(`select * from public.${table}`),
            /permission denied/,
          );
        await assert.rejects(
          db.query("select public.resolve_and_log_redirect($1,$2)", [
            "nfc",
            nfc.short_code,
          ]),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select public.create_acquisition_asset($1,$2)", [
            storeA,
            "Forbidden",
          ]),
          /permission denied/,
        );
      },
    );
    await t.test(
      "short-code UNIQUE prevents duplication and failed retry leaves no partial asset",
      async () => {
        await admin(
          `alter table public.acquisition_endpoints alter column short_code set default '${nfc.short_code}';`,
        );
        await asUser();
        await assert.rejects(
          db.query("select public.create_acquisition_asset($1,$2)", [
            storeA,
            "Collision",
          ]),
          /unique constraint/,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.acquisition_assets where name='Collision'",
            )
          ).rows.length,
          0,
        );
        await admin(
          "alter table public.acquisition_endpoints alter column short_code set default replace(gen_random_uuid()::text,'-','');",
        );
      },
    );
    await t.test(
      "failure after NFC insertion rolls back asset and the first endpoint",
      async () => {
        await admin(`create function private.test_fail_qr() returns trigger language plpgsql as $$ begin if new.type='qr' then raise exception 'test QR failure';end if;return new;end;$$;
    create trigger test_fail_qr before insert on public.acquisition_endpoints for each row execute function private.test_fail_qr();`);
        const before = (
          await db.query("select * from public.acquisition_endpoints")
        ).rows.length;
        await asUser();
        await assert.rejects(
          db.query("select public.create_acquisition_asset($1,$2)", [
            storeA,
            "Partial",
          ]),
          /test QR failure/,
        );
        await db.exec("reset role");
        assert.equal(
          (await db.query("select * from public.acquisition_endpoints")).rows
            .length,
          before,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.acquisition_assets where name='Partial'",
            )
          ).rows.length,
          0,
        );
        await admin(
          "drop trigger test_fail_qr on public.acquisition_endpoints;drop function private.test_fail_qr();",
        );
      },
    );
    await t.test(
      "invalid URLs fail in SQL and application validation",
      async () => {
        await asUser();
        for (const url of [
          "https://g.page/r/abc/review",
          "https://g.page/shortname/review",
          "https://search.google.com/local/writereview?placeid=ChIJ_1",
          "https://g.page.evil.test/a/review",
          "javascript:alert(1)",
          "https://g.page/r/a/review?url=https://evil.test",
          "https://g.page/r/a/review\n",
        ]) {
          const result = await db.query<{ valid: boolean }>(
            "select private.valid_review_url($1) as valid",
            [url],
          );
          assert.equal(result.rows[0].valid, isGoogleReviewUrl(url), url);
        }
        await assert.rejects(
          db.query(
            "update public.stores set google_review_url=$1 where id=$2",
            ["https://evil.test", storeA],
          ),
          /check constraint/,
        );
      },
    );
    await t.test(
      "counts exceed 1000 rows, respect exact period bounds and preserve zeros",
      async () => {
        await admin("delete from public.access_logs;");
        const insert = `insert into public.access_logs(acquisition_endpoint_id,acquisition_asset_id,store_id,access_method,accessed_at,redirected_at) values($1,$2,$3,$4,$5,$5)`;
        await db.query(insert, [
          nfc.id,
          assetA,
          storeA,
          "nfc",
          "2026-09-29T14:59:59Z",
        ]);
        await db.query(insert, [
          nfc.id,
          assetA,
          storeA,
          "nfc",
          "2026-09-29T15:00:00Z",
        ]);
        await db.query(insert, [
          qr.id,
          assetA,
          storeA,
          "qr",
          "2026-09-30T02:00:00Z",
        ]);
        await db.query(insert, [
          qr.id,
          assetA,
          storeA,
          "qr",
          "2026-09-30T15:00:00Z",
        ]);
        await db.query(
          `insert into public.access_logs(acquisition_endpoint_id,acquisition_asset_id,store_id,access_method,accessed_at,redirected_at)
    select $1,$2,$3,'nfc','2026-09-30T01:00:00Z'::timestamptz,'2026-09-30T01:00:00Z'::timestamptz from generate_series(1,1005)`,
          [nfc.id, assetA, storeA],
        );
        await asUser();
        const summary = (
          await db.query<{ s: Summary }>(
            "select public.access_summary($1,$2,$3,$4) as s",
            ["2026-09-29T15:00:00Z", "2026-09-30T15:00:00Z", storeA, assetA],
          )
        ).rows[0].s;
        assert.deepEqual(summary.totals, { nfc: 1006, qr: 1, total: 1007 });
        assert.equal(summary.daily[0].day, "2026-09-30");
        assert.equal(summary.assets.length, 1);
        assert.equal(summary.stores.length, 1);
        const counts = (
          await db.query<{ total: number }>(
            "select total::int from public.asset_access_counts($1)",
            [[assetA]],
          )
        ).rows[0];
        assert.equal(counts.total, 1009);
        await asUser(USER_B);
        const zero = (
          await db.query<{ s: Summary }>(
            "select public.access_summary($1,$2) as s",
            ["2026-09-29T15:00:00Z", "2026-09-30T15:00:00Z"],
          )
        ).rows[0].s;
        assert.deepEqual(zero.totals, { nfc: 0, qr: 0, total: 0 });
        assert.equal(zero.assets[0].total, 0);
      },
    );
  } finally {
    await db.close();
  }
});
