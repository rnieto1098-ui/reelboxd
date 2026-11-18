import { test } from "node:test";
import assert from "node:assert/strict";
import { isWesternActor } from "./westernActors.ts";

const actor = (langs: [string, number][]) => ({
  known_for_department: "Acting",
  known_for: langs.map(([original_language, vote_count]) => ({ original_language, vote_count })),
});

test("keeps actors known mainly for widely seen Western-language films", () => {
  assert.equal(isWesternActor(actor([["en", 20000], ["en", 9000], ["en", 1500]])), true);
  assert.equal(isWesternActor(actor([["fr", 3000], ["fr", 2000]])), true);
  assert.equal(isWesternActor(actor([["en", 5000], ["es", 4000], ["en", 1200]])), true);
});

test("drops actors known mainly for other-language films", () => {
  assert.equal(isWesternActor(actor([["ko", 9000], ["ko", 4000], ["en", 2000]])), false);
  assert.equal(isWesternActor(actor([["te", 500]])), false);
});

test("drops names with no widely seen film, non-actors and empty records", () => {
  assert.equal(isWesternActor(actor([["en", 120], ["en", 300]])), false);
  // One big film and two small ones: a bit part, not a star.
  assert.equal(isWesternActor(actor([["en", 30000], ["en", 200], ["en", 90]])), false);
  assert.equal(isWesternActor({ known_for_department: "Directing", known_for: [{ original_language: "en", vote_count: 9000 }] }), false);
  assert.equal(isWesternActor({ known_for_department: "Acting" }), false);
});
