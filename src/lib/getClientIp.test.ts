import { test } from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "./getClientIp.ts";

test("reads the first IP from a single-value x-forwarded-for header", () => {
  const req = new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.5" } });
  assert.equal(getClientIp(req), "203.0.113.5");
});

test("takes the original client, not the proxies, from a comma-separated chain", () => {
  const req = new Request("http://localhost", {
    headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" },
  });
  assert.equal(getClientIp(req), "203.0.113.5");
});

test("trims whitespace around the IP", () => {
  const req = new Request("http://localhost", { headers: { "x-forwarded-for": "  203.0.113.5  , 70.41.3.18" } });
  assert.equal(getClientIp(req), "203.0.113.5");
});

test("falls back to 'unknown' when the header is missing", () => {
  const req = new Request("http://localhost");
  assert.equal(getClientIp(req), "unknown");
});
