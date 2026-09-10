// Regression coverage for the cron routes' fail-open bug: they used to skip
// auth entirely whenever CRON_SECRET was unset, rather than treating that as
// "reject everything." Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "./cronAuth.ts";

function requestWith(auth?: string): Request {
  return new Request("http://localhost/api/cron/x", {
    headers: auth ? { authorization: auth } : {},
  });
}

test("a correct bearer token is authorized", () => {
  assert.equal(isAuthorizedCronRequest(requestWith("Bearer s3cret"), { CRON_SECRET: "s3cret" }), true);
});

test("a wrong or missing token is rejected when a secret is configured", () => {
  const env = { CRON_SECRET: "s3cret" };
  assert.equal(isAuthorizedCronRequest(requestWith("Bearer nope"), env), false);
  assert.equal(isAuthorizedCronRequest(requestWith(), env), false);
});

test("an unset secret fails closed in production — the bug this fixes", () => {
  // No CRON_SECRET at all, matching a deploy where the env var was never
  // configured. The old code treated this as "skip the check."
  assert.equal(isAuthorizedCronRequest(requestWith(), { NODE_ENV: "production" }), false);
});

test("an unset secret stays permissive outside production", () => {
  assert.equal(isAuthorizedCronRequest(requestWith(), { NODE_ENV: "development" }), true);
});

test("a configured secret is still enforced even in development", () => {
  assert.equal(
    isAuthorizedCronRequest(requestWith("Bearer wrong"), { NODE_ENV: "development", CRON_SECRET: "s3cret" }),
    false
  );
});
