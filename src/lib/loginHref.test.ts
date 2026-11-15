import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "./loginHref.ts";

test("returns to an ordinary path on this site", () => {
  assert.equal(safeNextPath("/movie/157336"), "/movie/157336");
  assert.equal(safeNextPath("/search?q=dune&page=2"), "/search?q=dune&page=2");
});

test("falls back to home for anything that could leave the site", () => {
  const backslashHost = "/" + String.fromCharCode(92) + "evil.example";
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    backslashHost,
    "evil",
    "",
    null,
    undefined,
    5,
    "/a\nb",
  ]) {
    assert.equal(safeNextPath(bad), "/", String(bad));
  }
});

test("never loops back to the sign-in pages", () => {
  assert.equal(safeNextPath("/login"), "/");
  assert.equal(safeNextPath("/signup?x=1"), "/");
});
