import test from "node:test";
import assert from "node:assert/strict";
import {
  handleRedirect,
  redirectError,
} from "../src/features/redirect/service";
import { createRedirectGateway } from "../src/features/redirect/gateway";
const input = { type: "nfc", shortCode: "a".repeat(32), userAgent: null };
test("rejects malformed codes before contacting DB or reading config", async () => {
  for (const shortCode of [
    "",
    "invalid",
    "A".repeat(32),
    "a".repeat(33),
    "a".repeat(32) + "\n",
    "<script>",
  ]) {
    let called = false;
    const r = await handleRedirect(
      { ...input, shortCode },
      {
        resolveAndLog: async () => {
          called = true;
          return null;
        },
      },
    );
    assert.equal(r.status, 404);
    assert.equal(called, false);
    assert.doesNotMatch(await r.text(), /<script>/);
  }
});
test("returns no-cache 302 without intermediate page, IP or session dependency", async () => {
  const r = await handleRedirect(input, {
    resolveAndLog: async (value) => {
      assert.equal(value.userAgent, null);
      return "https://g.page/r/GoogleId/review";
    },
  });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "https://g.page/r/GoogleId/review");
  assert.equal(await r.text(), "");
  assert.match(r.headers.get("cache-control")!, /no-store/);
});
test("bounds user agent and strips null characters", async () => {
  await handleRedirect(
    { ...input, userAgent: "a\0".repeat(1000) },
    {
      resolveAndLog: async (value) => {
        assert.equal(value.userAgent?.length, 512);
        assert.ok(!value.userAgent?.includes("\0"));
        return null;
      },
    },
  );
});
test("refuses unsafe destinations and handles logging/DB failures safely", async () => {
  const r = await handleRedirect(input, {
    resolveAndLog: async () => "https://evil.test",
  });
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("location"), null);
  const failed = await handleRedirect(input, {
    resolveAndLog: async () => {
      throw new Error("secret internal DB detail");
    },
  });
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("location"), null);
  assert.doesNotMatch(await failed.text(), /secret/);
  assert.equal(redirectError(405).headers.get("allow"), "GET");
});
test("rate limiter interface can reject before recording a hit", async () => {
  let calls = 0;
  const r = await handleRedirect(input, {
    allowRequest: async () => false,
    resolveAndLog: async () => {
      calls++;
      return null;
    },
  });
  assert.equal(r.status, 429);
  assert.equal(calls, 0);
});
test("gateway calls one narrow RPC with timeout and no IP/cookies", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://project.example/rest/v1/rpc/resolve_and_log_redirect",
    );
    assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_type: "nfc",
      p_short_code: input.shortCode,
      p_user_agent: null,
    });
    assert.equal(new Headers(init?.headers).get("cookie"), null);
    return Response.json("https://g.page/store/review");
  };
  assert.equal(
    await createRedirectGateway(
      { supabaseUrl: "https://project.example", serviceRoleKey: "test-only" },
      fetcher,
    )(input),
    "https://g.page/store/review",
  );
  assert.equal(calls, 1);
  for (const mock of [
    async () => new Response("", { status: 500 }),
    async () => Response.json({ unexpected: true }),
    async () => {
      throw new Error("timeout");
    },
  ])
    await assert.rejects(
      createRedirectGateway(
        { supabaseUrl: "https://project.example", serviceRoleKey: "test-only" },
        mock,
      )(input),
    );
});
