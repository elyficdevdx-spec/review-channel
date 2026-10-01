import test from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrPng, qrSvg } from "../src/features/acquisition/qr";
import { endpointUrl } from "../src/features/acquisition/urls";
import {
  periodRange,
  periodDays,
  jstDay,
} from "../src/features/analytics/period";
import { createAssetSchema } from "../src/features/acquisition/validation";
test("generated QR decodes to the QR tracking URL, not Google or NFC", async () => {
  const code = "a".repeat(32),
    origin = "https://reviews.example";
  const png = PNG.sync.read(await qrPng(origin, code));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, `${origin}/r/qr/${code}`);
  const svg = await qrSvg(origin, code);
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /<script/);
  assert.notEqual(endpointUrl(origin, "nfc", code), decoded?.data);
  assert.throws(() => endpointUrl("javascript:alert(1)", "qr", code));
  assert.throws(() => endpointUrl("http://public.example", "qr", code));
  assert.equal(
    endpointUrl("http://localhost:3000", "qr", code),
    `http://localhost:3000/r/qr/${code}`,
  );
});
test("JST calendar periods span today and the previous 6/29 days", () => {
  const now = new Date("2026-09-30T02:00:00Z");
  assert.equal(periodRange("today", now).from, "2026-09-29T15:00:00.000Z");
  assert.equal(periodRange("7d", now).from, "2026-09-23T15:00:00.000Z");
  assert.equal(periodRange("30d", now).from, "2026-08-31T15:00:00.000Z");
  const range = periodRange("30d", now);
  assert.equal(periodDays(range.from, range.to).length, 30);
  assert.equal(jstDay("2026-09-29T15:00:00Z"), "2026-09-30");
  assert.equal(jstDay("2026-09-29T14:59:59Z"), "2026-09-29");
});
test("asset input rejects missing stores and invalid names", () => {
  const valid = {
    store_id: "00000000-0000-4000-8000-000000000001",
    name: " Counter ",
  };
  assert.equal(createAssetSchema.parse(valid).name, "Counter");
  for (const patch of [
    { store_id: "other" },
    { name: "" },
    { name: "x".repeat(121) },
  ])
    assert.equal(
      createAssetSchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
});
