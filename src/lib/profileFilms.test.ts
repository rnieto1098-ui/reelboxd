import { test } from "node:test";
import assert from "node:assert/strict";
import { filmsHref, formatStars, parseFilmsParams, sortFilms, type FilmRow } from "./profileFilms.ts";

test("parseFilmsParams defaults and validates", () => {
  assert.deepEqual(parseFilmsParams({}), { sort: "rated", dir: "desc", stars: null, page: 1 });
  assert.deepEqual(parseFilmsParams({ sort: "title" }), { sort: "title", dir: "asc", stars: null, page: 1 });
  assert.equal(parseFilmsParams({ stars: "4.5" }).stars, 4.5);
  assert.equal(parseFilmsParams({ stars: "4.3" }).stars, null);
  assert.equal(parseFilmsParams({ stars: "unrated" }).stars, "unrated");
  assert.equal(parseFilmsParams({ sort: "nope", page: "-2" }).sort, "rated");
  assert.equal(parseFilmsParams({ page: "3" }).page, 3);
});

test("filmsHref leaves defaults out of the URL and round-trips", () => {
  assert.equal(filmsHref("ann", parseFilmsParams({})), "/profile/ann/films");
  const p = { sort: "rating" as const, dir: "asc" as const, stars: 5, page: 2 };
  const href = filmsHref("ann", p);
  const parsed = parseFilmsParams(Object.fromEntries(new URL(href, "http://x").searchParams));
  assert.deepEqual(parsed, p);
  assert.equal(filmsHref("ann", parseFilmsParams({ sort: "title" })), "/profile/ann/films?sort=title");
});

test("formatStars draws whole and half stars", () => {
  assert.equal(formatStars(5), "★★★★★");
  assert.equal(formatStars(3.5), "★★★½");
  assert.equal(formatStars(0.5), "½");
});

test("sortFilms orders like the database does", () => {
  const row = (title: string, score: number | null, release: string | null, at: number): FilmRow => ({
    tmdbId: at, title, posterPath: null, releaseDate: release, score, at: new Date(at),
  });
  const rows = [row("beta", 3, "2001-01-01", 1), row("Alpha", 5, "1999-05-01", 2), row("gamma", null, null, 3)];
  assert.deepEqual(sortFilms(rows, "title", "asc").map((r) => r.title), ["Alpha", "beta", "gamma"]);
  assert.deepEqual(sortFilms(rows, "rated", "desc").map((r) => r.tmdbId), [3, 2, 1]);
  assert.deepEqual(sortFilms(rows, "rating", "desc").map((r) => r.title), ["Alpha", "beta", "gamma"]);
  assert.deepEqual(sortFilms(rows, "release", "desc").map((r) => r.title), ["beta", "Alpha", "gamma"]);
});
