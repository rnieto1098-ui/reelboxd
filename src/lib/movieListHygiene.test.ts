// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMovieList } from "./movieListHygiene.ts";

test("drops a movie with an empty title", () => {
  const result = cleanMovieList([
    { id: 1, title: "" },
    { id: 2, title: "Real Movie" },
  ]);
  assert.deepEqual(result.map((m) => m.id), [2]);
});

test("drops a movie with a whitespace-only title", () => {
  assert.deepEqual(cleanMovieList([{ id: 1, title: "   " }]), []);
});

test("drops a later duplicate id, keeping the first occurrence", () => {
  const result = cleanMovieList([
    { id: 1, title: "First" },
    { id: 2, title: "Other" },
    { id: 1, title: "First (dup)" },
  ]);
  assert.deepEqual(result, [
    { id: 1, title: "First" },
    { id: 2, title: "Other" },
  ]);
});

test("preserves order and passes extra fields through untouched", () => {
  const movies = [{ id: 5, title: "X", year: "2020" }];
  assert.deepEqual(cleanMovieList(movies), movies);
});

test("an already-clean list is unchanged", () => {
  const movies = [
    { id: 1, title: "A" },
    { id: 2, title: "B" },
  ];
  assert.deepEqual(cleanMovieList(movies), movies);
});

test("an empty list stays empty", () => {
  assert.deepEqual(cleanMovieList([]), []);
});
