import { test } from "node:test";
import assert from "node:assert/strict";
import { applySavedOrder, parseListOrder } from "./listOrder.ts";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join("");

test("no saved order keeps the incoming order", () => {
  assert.equal(ids(applySavedOrder(items, [], "start")), "abcd");
});

test("saved order is applied; unplaced items go first or last", () => {
  assert.equal(ids(applySavedOrder(items, ["c", "a"], "end")), "cabd");
  assert.equal(ids(applySavedOrder(items, ["c", "a"], "start")), "bdca");
});

test("ids that no longer exist are ignored", () => {
  assert.equal(ids(applySavedOrder(items, ["zz", "d", "b", "c", "a"], "end")), "dbca");
});

test("parsing tolerates empty and stray commas", () => {
  assert.deepEqual(parseListOrder(null), []);
  assert.deepEqual(parseListOrder("a,,b,"), ["a", "b"]);
});
