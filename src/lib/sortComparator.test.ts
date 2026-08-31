// Regression coverage for the sort-direction bug that shipped independently
// in two different pages (list detail + crew person) before being caught:
// `(vb - va) * (dir === "asc" ? 1 : -1)` looks plausible but is backwards.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { compareNullableNumbers } from "./sortComparator.ts";

test("desc sorts highest value first", () => {
  assert.ok(compareNullableNumbers(10, 5, "desc") < 0);
  assert.ok(compareNullableNumbers(5, 10, "desc") > 0);
});

test("asc sorts lowest value first", () => {
  assert.ok(compareNullableNumbers(5, 10, "asc") < 0);
  assert.ok(compareNullableNumbers(10, 5, "asc") > 0);
});

test("equal values compare as equal in both directions", () => {
  assert.equal(compareNullableNumbers(7, 7, "desc"), 0);
  assert.equal(compareNullableNumbers(7, 7, "asc"), 0);
});

test("a real array sorts correctly in both directions (not just pairwise)", () => {
  const values = [3, 1, 4, 1, 5, 9, 2, 6];
  const desc = [...values].sort((a, b) => compareNullableNumbers(a, b, "desc"));
  const asc = [...values].sort((a, b) => compareNullableNumbers(a, b, "asc"));
  assert.deepEqual(desc, [9, 6, 5, 4, 3, 2, 1, 1]);
  assert.deepEqual(asc, [1, 1, 2, 3, 4, 5, 6, 9]);
});

test("null values always sort to the end, regardless of direction", () => {
  assert.ok(compareNullableNumbers(null, 5, "desc") > 0);
  assert.ok(compareNullableNumbers(5, null, "desc") < 0);
  assert.ok(compareNullableNumbers(null, 5, "asc") > 0);
  assert.ok(compareNullableNumbers(5, null, "asc") < 0);
});

test("both null compares as equal", () => {
  assert.equal(compareNullableNumbers(null, null, "desc"), 0);
  assert.equal(compareNullableNumbers(null, null, "asc"), 0);
});

test("items with missing data land last after a real sort, in either direction", () => {
  const values: (number | null)[] = [null, 8, null, 3];
  const desc = [...values].sort((a, b) => compareNullableNumbers(a, b, "desc"));
  const asc = [...values].sort((a, b) => compareNullableNumbers(a, b, "asc"));
  assert.deepEqual(desc, [8, 3, null, null]);
  assert.deepEqual(asc, [3, 8, null, null]);
});
