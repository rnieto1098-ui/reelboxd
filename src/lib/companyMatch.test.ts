import { test } from "node:test";
import assert from "node:assert/strict";
import { pickCompany } from "./companyMatch.ts";

test("prefers the exact-name studio that has a logo over a logo-less duplicate", () => {
  const results = [
    { id: 313310, name: "Universal Pictures", logo_path: null },
    { id: 33, name: "Universal Pictures", logo_path: "/u.png" },
    { id: 9, name: "Universal Pictures International", logo_path: "/i.png" },
  ];
  assert.equal(pickCompany("Universal Pictures", results)?.id, 33);
});

test("falls back to any exact match, then the top hit", () => {
  assert.equal(
    pickCompany("A24", [
      { id: 2, name: "A24 Films", logo_path: "/x.png" },
      { id: 1, name: "a24", logo_path: null },
    ])?.id,
    1
  );
  assert.equal(pickCompany("Pixar", [{ id: 3, name: "Pixar Animation Studios", logo_path: null }])?.id, 3);
  assert.equal(pickCompany("Nobody", []), undefined);
});
