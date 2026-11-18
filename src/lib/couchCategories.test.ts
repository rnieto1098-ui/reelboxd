import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceCategories } from "./couch/categories.ts";

const NOW = new Date("2026-11-18T12:00:00Z");

test("opens on what's new, with a year-long window", () => {
  const [first] = serviceCategories("Netflix", [], NOW);
  assert.equal(first.title, "New on Netflix");
  assert.equal(first.query.releasedAfter, "2025-11-18");
});

test("favourite genres come next, in the user's order, and aren't repeated", () => {
  const rows = serviceCategories("Netflix", ["Horror", "Thriller", "Science Fiction"], NOW);
  assert.deepEqual(rows.slice(1, 4).map((r) => r.title), [
    "Horror, your favourite",
    "Thrillers, your favourite",
    "Sci-Fi & Fantasy, your favourite",
  ]);
  const titles = rows.map((r) => r.title);
  assert.ok(!titles.includes("Horror"));
  assert.ok(!titles.includes("Thrillers"));
});

test("every key is unique and every genre appears once", () => {
  const rows = serviceCategories("Hulu", ["Adventure"], NOW);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length);
  // Adventure shares a row with Action, so that row is the favourite.
  assert.equal(rows[1].title, "Action & Adventure, your favourite");
  assert.equal(rows.filter((r) => r.title.startsWith("Action")).length, 1);
  assert.ok(rows.length >= 15);
});
