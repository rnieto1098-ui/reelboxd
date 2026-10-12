import { test } from "node:test";
import assert from "node:assert/strict";
import { matchingPeople, nameMatchesQuery } from "./personMatch.ts";

test("every query word must start a name word", () => {
  assert.equal(nameMatchesQuery("Christopher Nolan", "nolan"), true);
  assert.equal(nameMatchesQuery("Christopher Nolan", "chris nolan"), true);
  assert.equal(nameMatchesQuery("Christopher Nolan", "NOLAN christopher"), true);
  assert.equal(nameMatchesQuery("Christopher Nolan", "olan"), false);
  assert.equal(nameMatchesQuery("Christopher Nolan", "nolan inception"), false);
});

test("accents and punctuation are ignored", () => {
  assert.equal(nameMatchesQuery("Zoë Kravitz", "zoe kravitz"), true);
  assert.equal(nameMatchesQuery("Lupita Nyong'o", "nyong"), true);
});

test("movie-title queries don't match unrelated people", () => {
  assert.equal(nameMatchesQuery("Keanu Reeves", "the matrix"), false);
  assert.equal(nameMatchesQuery("Anyone", "   "), false);
});

test("matches are ranked by popularity and capped", () => {
  const people = [
    { name: "Tom Hanks", popularity: 50 },
    { name: "Tom Holland", popularity: 80 },
    { name: "Tim Burton", popularity: 99 },
    { name: "Tom Hardy" },
  ];
  assert.deepEqual(
    matchingPeople(people, "tom", 2).map((p) => p.name),
    ["Tom Holland", "Tom Hanks"]
  );
});
