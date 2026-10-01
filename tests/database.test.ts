import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces tenant isolation and atomic owner creation", async () => {
  const db = new PGlite();
  try {
    // Only the Auth contract is stubbed; migrations, roles, privileges and RLS
    // execute on PostgreSQL. A deployed Supabase Auth flow still needs an E2E check.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('00000000-0000-4000-8000-000000000001');
    `);
    await db.exec(
      await readFile(
        "supabase/migrations/20260929000000_phase1_foundation.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into auth.users values ('00000000-0000-4000-8000-000000000002');`,
    );
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      2,
      "backfill and trigger create profiles",
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';`,
    );
    const created = await db.query<{ id: string }>(
      `select public.create_store('Store A', 'Tokyo', 'https://g.page/store-a/review') as id`,
    );
    const storeId = created.rows[0].id;
    assert.equal(
      (await db.query("select * from public.stores")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.store_users")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
    await db.query(`update public.stores set name = 'Updated' where id = $1`, [
      storeId,
    ]);
    assert.equal(
      (await db.query<{ name: string }>("select name from public.stores"))
        .rows[0].name,
      "Updated",
    );
    await assert.rejects(
      db.exec(
        `insert into public.stores(name,address,google_review_url) values('Bypass','Tokyo','https://g.page/a/review')`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `insert into public.store_users(store_id,user_id) values('${storeId}','00000000-0000-4000-8000-000000000002')`,
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(`update public.stores set google_account_id = 'forged'`),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(`delete from public.store_users`),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `select public.create_store('Unsafe','Tokyo','https://evil.example')`,
      ),
      /check constraint/,
    );
    assert.equal(
      (await db.query("select * from public.stores")).rows.length,
      1,
      "failed creation leaves no partial store",
    );
    await db.exec(
      `set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';`,
    );
    assert.equal(
      (await db.query("select * from public.stores")).rows.length,
      0,
      "other user cannot read store",
    );
    assert.equal(
      (await db.query("select * from public.store_users")).rows.length,
      0,
      "other user cannot read memberships",
    );
    assert.equal(
      (
        await db.query(
          `update public.stores set name='Hacked' where id=$1 returning id`,
          [storeId],
        )
      ).rows.length,
      0,
      "other user cannot update store",
    );
    await db.exec(
      `select public.create_store('Store B','Osaka','https://search.google.com/local/writereview?placeid=ChIJ_B')`,
    );
    assert.equal(
      (await db.query("select * from public.stores")).rows.length,
      1,
    );
    await db.exec(
      `set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';`,
    );
    await assert.rejects(
      db.exec(
        `select public.create_store('Orphan','Tokyo','https://g.page/orphan/review')`,
      ),
      /foreign key constraint/,
    );
    await db.exec(`reset role;`);
    assert.equal(
      (await db.query("select * from public.stores where name = 'Orphan'")).rows
        .length,
      0,
      "membership failure rolls back the store insert",
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '';`);
    await assert.rejects(
      db.exec(
        `select public.create_store('Anonymous','Tokyo','https://g.page/a/review')`,
      ),
      /Authentication required/,
    );
    await db.exec(`reset role; set role anon;`);
    await assert.rejects(
      db.exec("select * from public.stores"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(
        `select public.create_store('Anonymous','Tokyo','https://g.page/a/review')`,
      ),
      /permission denied/,
    );
    await db.exec(`reset role;`);
    assert.equal(
      (await db.query("select * from public.stores")).rows.length,
      2,
    );
  } finally {
    await db.close();
  }
});
