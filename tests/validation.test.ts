import test from "node:test";
import assert from "node:assert/strict";
import {
  isGoogleReviewUrl,
  storeSchema,
} from "../src/features/stores/validation";
test("accepts supported Google review links", () => {
  for (const url of [
    "https://g.page/example/review",
    "https://search.google.com/local/writereview?placeid=ChIJ_example",
  ])
    assert.equal(isGoogleReviewUrl(url), true, url);
});
test("rejects redirect and script URL bypasses", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://g.page/example/review",
    "https://g.page.evil.test/example/review",
    "https://g.page@example.com/a/review",
    "https://google.com/url?q=https://evil.test",
    "https://g.page/a/review?url=https://evil.test",
    "https://search.google.com/local/writereview?placeid=x&continue=https://evil.test",
    "https://g.page:8443/a/review",
    "https://g.page/a/review#bad",
    "https://g.page/a/../review",
    "https://g.page/a/review\\@evil.test",
    "https://search.google.com/local/writereview?placeid=",
  ])
    assert.equal(isGoogleReviewUrl(url), false, url);
});
test("validates and normalizes store input", () => {
  const input = {
    name: " Cafe ",
    address: " Tokyo ",
    google_review_url: "https://g.page/cafe/review",
    status: "active",
  };
  assert.equal(storeSchema.parse(input).name, "Cafe");
  for (const patch of [
    { name: " " },
    { name: "x".repeat(121) },
    { address: "" },
    { status: "owner" },
    { google_review_url: "https://example.com" },
  ])
    assert.equal(storeSchema.safeParse({ ...input, ...patch }).success, false);
});
