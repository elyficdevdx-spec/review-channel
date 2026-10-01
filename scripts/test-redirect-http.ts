/** Local test fixture only. No live Supabase credentials or external requests. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import type { AddressInfo } from "node:net";

async function main() {
  const db = new PGlite();
  let rpcCalls = 0,
    otherCalls = 0;
  const fixtureKey = "http-fixture-only-not-a-real-key";
  const rpcServer = createServer(async (req, res) => {
    if (
      req.url !== "/rest/v1/rpc/resolve_and_log_redirect" ||
      req.method !== "POST"
    ) {
      otherCalls++;
      res.writeHead(404).end();
      return;
    }
    try {
      assert.equal(req.headers.authorization, `Bearer ${fixtureKey}`);
      assert.equal(req.headers.apikey, fixtureKey);
      let body = "";
      for await (const chunk of req) body += chunk;
      const { p_type, p_short_code, p_user_agent } = JSON.parse(body);
      rpcCalls++;
      await db.exec("reset role;set role service_role");
      const result = await db.query<{ url: string | null }>(
        "select public.resolve_and_log_redirect($1,$2,$3) as url",
        [p_type, p_short_code, p_user_agent],
      );
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(result.rows[0].url));
    } catch {
      res
        .writeHead(500, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: "fixture failure" }));
    }
  });
  let next: ReturnType<typeof spawn> | undefined;
  let output = "";
  try {
    await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    for (const m of [
      "20260929000000_phase1_foundation.sql",
      "20260930000000_phase2_acquisition.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${m}`, "utf8"));
    await db.exec(
      `insert into auth.users values('00000000-0000-4000-8000-000000000001');set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';`,
    );
    const store = (
      await db.query<{ id: string }>(
        "select public.create_store('HTTP test','Tokyo','https://g.page/r/HttpTest/review') as id",
      )
    ).rows[0].id;
    const asset = (
      await db.query<{ id: string }>(
        "select public.create_acquisition_asset($1,'HTTP asset') as id",
        [store],
      )
    ).rows[0].id;
    const endpoints = (
      await db.query<{ type: string; short_code: string }>(
        "select type,short_code from public.acquisition_endpoints order by type",
      )
    ).rows;
    rpcServer.listen(0, "127.0.0.1");
    await once(rpcServer, "listening");
    const dbOrigin = `http://127.0.0.1:${(rpcServer.address() as AddressInfo).port}`;
    // Port 0 asks the OS for an available port, avoiding scans or unrelated servers.
    next = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "0",
      ],
      {
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: dbOrigin,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "http-fixture-public",
          SUPABASE_SERVICE_ROLE_KEY: fixtureKey,
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const origin = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Next did not start: ${output}`)),
        20000,
      );
      const consume = (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
        if (match && output.includes("Ready")) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      };
      next!.stdout!.on("data", consume);
      next!.stderr!.on("data", consume);
      next!.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      next!.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Next exited ${code}: ${output}`));
      });
    });
    for (const e of endpoints) {
      const response = await fetch(`${origin}/r/${e.type}/${e.short_code}`, {
        redirect: "manual",
      });
      assert.equal(response.status, 302);
      assert.equal(
        response.headers.get("location"),
        "https://g.page/r/HttpTest/review",
      );
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert.equal(await response.text(), "");
    }
    const nfc = endpoints.find((e) => e.type === "nfc")!,
      qr = endpoints.find((e) => e.type === "qr")!;
    for (const path of [
      `/r/nfc/${qr.short_code}`,
      "/r/nfc/invalid",
      `/r/qr/${"0".repeat(32)}`,
    ])
      assert.equal(
        (await fetch(origin + path, { redirect: "manual" })).status,
        404,
      );
    const beforeHead = rpcCalls;
    assert.equal(
      (await fetch(`${origin}/r/nfc/${nfc.short_code}`, { method: "HEAD" }))
        .status,
      405,
    );
    assert.equal(rpcCalls, beforeHead);
    assert.equal(
      otherCalls,
      0,
      "redirect requests must not call Supabase Auth",
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.access_logs")).rows.length,
      2,
    );
    await db.query(
      "update public.acquisition_assets set status='inactive' where id=$1",
      [asset],
    );
    for (const e of endpoints)
      assert.equal(
        (
          await fetch(`${origin}/r/${e.type}/${e.short_code}`, {
            redirect: "manual",
          })
        ).status,
        404,
      );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from public.access_logs")).rows.length,
      2,
    );
    // Connection failure must not become an unlogged Google redirect.
    await new Promise<void>((resolve) => rpcServer.close(() => resolve()));
    assert.equal(
      (await fetch(`${origin}/r/nfc/${nfc.short_code}`, { redirect: "manual" }))
        .status,
      503,
    );
    console.log(
      "HTTP smoke passed: Next Route Handlers → one server-only RPC → PostgreSQL logs → 302; invalid/type mismatch/inactive → 404; HEAD → 405; DB failure → 503; no Auth calls.",
    );
  } finally {
    if (next && next.exitCode === null) {
      const exit = once(next, "exit");
      next.kill("SIGTERM");
      await exit;
    }
    if (rpcServer.listening)
      await new Promise<void>((resolve) => rpcServer.close(() => resolve()));
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
