import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrompt } from "./parsePrompt.ts";

const GENRES = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
];

test("matches a genre name that appears literally in the prompt", () => {
  const parsed = parsePrompt("something scary with a horror vibe", undefined, GENRES);
  assert.ok(parsed.genreNames.includes("Horror"));
});

test("matches genre aliases that aren't the literal TMDB name", () => {
  const parsed = parsePrompt("looking for a good sci-fi movie", undefined, GENRES);
  assert.ok(parsed.genreNames.includes("Science Fiction"));
});

test("a rom-com alias pulls in both Romance and Comedy", () => {
  const parsed = parsePrompt("a fun rom-com for date night", undefined, GENRES);
  assert.ok(parsed.genreNames.includes("Romance"));
  assert.ok(parsed.genreNames.includes("Comedy"));
});

test("preset genre chips union with prompt-matched genres", () => {
  const parsed = parsePrompt("something scary", { genreNames: ["Action"] }, GENRES);
  assert.ok(parsed.genreNames.includes("Horror"));
  assert.ok(parsed.genreNames.includes("Action"));
});

test("an unrecognized preset genre name is ignored, not passed through blindly", () => {
  const parsed = parsePrompt("", { genreNames: ["Not A Real Genre"] }, GENRES);
  assert.ok(!parsed.genreNames.includes("Not A Real Genre"));
});

test("parses a 'under N hours' runtime cap", () => {
  const parsed = parsePrompt("something under 2 hours", undefined, GENRES);
  assert.equal(parsed.runtimeMaxMinutes, 120);
});

test("parses a 'under N minutes' runtime cap", () => {
  const parsed = parsePrompt("under 90 minutes please", undefined, GENRES);
  assert.equal(parsed.runtimeMaxMinutes, 90);
});

test("parses an 'over N hours' minimum runtime", () => {
  const parsed = parsePrompt("something over 3 hours, an epic", undefined, GENRES);
  assert.equal(parsed.runtimeMinMinutes, 180);
});

test("a bare 'N hour M minute' phrase is treated as an approximate cap with slack", () => {
  const parsed = parsePrompt("about 1 hour 30 minutes long", undefined, GENRES);
  assert.equal(parsed.runtimeMaxMinutes, 100); // 90 + 10 minutes of slack
});

test("an explicit runtime phrase takes priority over the bare-hours fallback", () => {
  const parsed = parsePrompt("under 2 hours, roughly 3 hours long", undefined, GENRES);
  assert.equal(parsed.runtimeMaxMinutes, 120);
});

test("a preset runtime chip combines with a text-parsed cap by taking the smaller one", () => {
  const stricter = parsePrompt("under 3 hours", { maxRuntimeMinutes: 90 }, GENRES);
  assert.equal(stricter.runtimeMaxMinutes, 90);

  const textIsStricter = parsePrompt("under 1 hour", { maxRuntimeMinutes: 180 }, GENRES);
  assert.equal(textIsStricter.runtimeMaxMinutes, 60);
});

test("parses a star rating into a 0-10 scale", () => {
  const parsed = parsePrompt("give me a 4 star movie", undefined, GENRES);
  assert.equal(parsed.minRating10, 8);
});

test("a rating already above 5 is treated as already being on the 10-point scale", () => {
  const parsed = parsePrompt("something with an 8 rating", undefined, GENRES);
  assert.equal(parsed.minRating10, 8);
});

test("'highly rated' phrasing implies a 7/10 floor without a number", () => {
  const parsed = parsePrompt("something highly rated", undefined, GENRES);
  assert.equal(parsed.minRating10, 7);
});

test("extracts a 'similar to X' movie title", () => {
  const parsed = parsePrompt("something similar to Mad Max, highly rated", undefined, GENRES);
  assert.equal(parsed.similarToQuery, "Mad Max");
});

test("extracts a title after 'like X'", () => {
  const parsed = parsePrompt("like Inception but shorter", undefined, GENRES);
  assert.equal(parsed.similarToQuery, "Inception");
});

test("no similar-to match when the prompt doesn't reference another movie", () => {
  const parsed = parsePrompt("a fun comedy", undefined, GENRES);
  assert.equal(parsed.similarToQuery, null);
});

test("allowR defaults to true (R allowed) unless a preset explicitly restricts it", () => {
  assert.equal(parsePrompt("", undefined, GENRES).allowR, true);
  assert.equal(parsePrompt("", { allowR: false }, GENRES).allowR, false);
});

test("onlyWatchlist and onlyStreaming default to false and pass through presets", () => {
  const defaults = parsePrompt("", undefined, GENRES);
  assert.equal(defaults.onlyWatchlist, false);
  assert.equal(defaults.onlyStreaming, false);

  const withPresets = parsePrompt("", { onlyWatchlist: true, onlyStreaming: true }, GENRES);
  assert.equal(withPresets.onlyWatchlist, true);
  assert.equal(withPresets.onlyStreaming, true);
});
