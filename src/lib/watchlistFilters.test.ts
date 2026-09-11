// Covers the watchlist filter bar's attribute matching and facet counting.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  certificationFacets,
  directorFacets,
  genreFacets,
  hasActiveFilters,
  matchesFilters,
  NO_FILTERS,
  runtimeFacets,
  type FilterableMovie,
} from "./watchlistFilters.ts";

function movie(overrides: Partial<FilterableMovie> = {}): FilterableMovie {
  return {
    runtime: 100,
    genres: [],
    directorId: null,
    directorName: null,
    certification: null,
    ...overrides,
  };
}

test("no active filters matches everything", () => {
  assert.equal(matchesFilters(movie(), NO_FILTERS), true);
  assert.equal(hasActiveFilters(NO_FILTERS), false);
});

test("genre filter requires the genre among the film's own list", () => {
  const filters = { ...NO_FILTERS, genre: "Horror" };
  assert.equal(matchesFilters(movie({ genres: ["Drama", "Horror"] }), filters), true);
  assert.equal(matchesFilters(movie({ genres: ["Drama"] }), filters), false);
  assert.equal(hasActiveFilters(filters), true);
});

test("director filter matches by id, not name", () => {
  const filters = { ...NO_FILTERS, directorId: 42 };
  assert.equal(matchesFilters(movie({ directorId: 42, directorName: "A" }), filters), true);
  assert.equal(matchesFilters(movie({ directorId: 7, directorName: "A" }), filters), false);
});

test("runtime filter buckets the same way the stats page does", () => {
  const filters = { ...NO_FILTERS, runtimeBucket: "Under 90m" };
  assert.equal(matchesFilters(movie({ runtime: 89 }), filters), true);
  assert.equal(matchesFilters(movie({ runtime: 90 }), filters), false);
  assert.equal(matchesFilters(movie({ runtime: null }), filters), false);
});

test("certification filter is an exact match", () => {
  const filters = { ...NO_FILTERS, certification: "R" };
  assert.equal(matchesFilters(movie({ certification: "R" }), filters), true);
  assert.equal(matchesFilters(movie({ certification: "PG-13" }), filters), false);
  assert.equal(matchesFilters(movie({ certification: null }), filters), false);
});

test("filters combine with AND, not OR", () => {
  const filters = { ...NO_FILTERS, genre: "Horror", certification: "R" };
  assert.equal(matchesFilters(movie({ genres: ["Horror"], certification: "R" }), filters), true);
  // Matches genre but not certification — the whole thing must fail.
  assert.equal(matchesFilters(movie({ genres: ["Horror"], certification: "PG-13" }), filters), false);
});

test("genre facets count once per appearance and sort by count then name", () => {
  const movies = [
    movie({ genres: ["Drama", "Crime"] }),
    movie({ genres: ["Drama"] }),
    movie({ genres: ["Comedy"] }),
  ];
  assert.deepEqual(genreFacets(movies), [
    { value: "Drama", label: "Drama", count: 2 },
    { value: "Comedy", label: "Comedy", count: 1 },
    { value: "Crime", label: "Crime", count: 1 },
  ]);
});

test("director facets group by id and use the id's own name, ignoring films with no director", () => {
  const movies = [
    movie({ directorId: 1, directorName: "Nolan" }),
    movie({ directorId: 1, directorName: "Nolan" }),
    movie({ directorId: 2, directorName: "Fincher" }),
    movie({ directorId: null, directorName: null }),
  ];
  assert.deepEqual(directorFacets(movies), [
    { value: 1, label: "Nolan", count: 2 },
    { value: 2, label: "Fincher", count: 1 },
  ]);
});

test("runtime facets are ordered shortest to longest and drop empty buckets", () => {
  const movies = [movie({ runtime: 200 }), movie({ runtime: 60 }), movie({ runtime: null })];
  assert.deepEqual(runtimeFacets(movies), [
    { value: "Under 90m", label: "Under 90m", count: 1 },
    { value: "3h and up", label: "3h and up", count: 1 },
  ]);
});

test("certification facets order known ratings by restrictiveness, unknowns alphabetically after", () => {
  const movies = [
    movie({ certification: "R" }),
    movie({ certification: "PG" }),
    movie({ certification: "PG" }),
    movie({ certification: "15" }), // not in CERTIFICATION_ORDER
  ];
  assert.deepEqual(certificationFacets(movies), [
    { value: "PG", label: "PG", count: 2 },
    { value: "R", label: "R", count: 1 },
    { value: "15", label: "15", count: 1 },
  ]);
});
