import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GENRE_IDS,
  buildTasteProfile,
  differentGenres,
  fitsGenres,
  genreIdsFromNames,
  parseRuntimeLimit,
  reasonGenre,
  scoreFilm,
  signalWeight,
  weightedPick,
  type TasteSignal,
} from "./discover/taste.ts";

const G = GENRE_IDS;

function signal(overrides: Partial<TasteSignal>): TasteSignal {
  return {
    tmdbId: 1,
    genreIds: [],
    directorId: null,
    directorName: null,
    castIds: [],
    castNames: [],
    score: null,
    dismissed: false,
    at: 0,
    title: "Film",
    ...overrides,
  };
}

test("genreIdsFromNames maps stored names and skips unknown ones", () => {
  assert.deepEqual(genreIdsFromNames("Drama, Crime, Nonsense"), [G.Drama, G.Crime]);
  assert.deepEqual(genreIdsFromNames(null), []);
});

test("signalWeight centres ratings on 3 stars and treats dismissals as negative", () => {
  assert.equal(signalWeight({ score: 5, dismissed: false }), 2);
  assert.equal(signalWeight({ score: 1, dismissed: false }), -2);
  assert.equal(signalWeight({ score: null, dismissed: false }), 0.5);
  assert.ok(signalWeight({ score: null, dismissed: true }) < 0);
});

test("a genre you rate highly outranks one you rate low or dismiss", () => {
  const profile = buildTasteProfile([
    signal({ tmdbId: 1, genreIds: [G.Thriller], score: 5 }),
    signal({ tmdbId: 2, genreIds: [G.Thriller, G.Crime], score: 4.5 }),
    signal({ tmdbId: 3, genreIds: [G.Romance], score: 1.5 }),
    signal({ tmdbId: 4, genreIds: [G.Horror], dismissed: true }),
  ]);
  assert.equal(profile.topGenres[0], G.Thriller);
  assert.ok(profile.genres[G.Romance] < 0);
  assert.ok(profile.genres[G.Horror] < 0);
  assert.ok(!profile.topGenres.includes(G.Horror));
  assert.equal(profile.genres[G.Thriller], 1);
});

test("people need two liked films to count", () => {
  const profile = buildTasteProfile([
    signal({ tmdbId: 1, directorId: 10, directorName: "A", score: 5 }),
    signal({ tmdbId: 2, directorId: 10, directorName: "A", score: 4 }),
    signal({ tmdbId: 3, directorId: 20, directorName: "B", score: 5 }),
    // Disliked films never make someone a favourite.
    signal({ tmdbId: 4, directorId: 30, directorName: "C", score: 2 }),
    signal({ tmdbId: 5, directorId: 30, directorName: "C", score: 2 }),
  ]);
  assert.deepEqual(
    profile.people.map((p) => p.id),
    [10]
  );
});

test("seeds prefer 4.5+ and fall back to 4", () => {
  const strict = buildTasteProfile([
    signal({ tmdbId: 1, score: 5, title: "Top" }),
    signal({ tmdbId: 2, score: 4, title: "Good" }),
  ]);
  assert.deepEqual(
    strict.seeds.map((s) => s.tmdbId),
    [1]
  );
  const loose = buildTasteProfile([signal({ tmdbId: 2, score: 4 })]);
  assert.deepEqual(
    loose.seeds.map((s) => s.tmdbId),
    [2]
  );
  assert.deepEqual(buildTasteProfile([signal({ score: 3 })]).seeds, []);
});

test("scoreFilm favours genre fit over a slightly better review", () => {
  const profile = buildTasteProfile([
    signal({ tmdbId: 1, genreIds: [G.Thriller], score: 5 }),
    signal({ tmdbId: 2, genreIds: [G.Romance], score: 1 }),
  ]);
  const thriller = { genre_ids: [G.Thriller], vote_average: 7.0, vote_count: 1000 };
  const romance = { genre_ids: [G.Romance], vote_average: 7.6, vote_count: 1000 };
  assert.ok(scoreFilm(thriller, profile) > scoreFilm(romance, profile));
  assert.equal(reasonGenre(thriller, profile), "Thriller");
  assert.equal(reasonGenre(romance, profile), null);
});

test("scoreFilm discounts averages from very few votes", () => {
  const profile = buildTasteProfile([]);
  const fewVotes = { genre_ids: [], vote_average: 9.5, vote_count: 5 };
  const manyVotes = { genre_ids: [], vote_average: 7.5, vote_count: 5000 };
  assert.ok(scoreFilm(manyVotes, profile) > scoreFilm(fewVotes, profile));
});

test("fitsGenres applies include-any and exclude-all", () => {
  const rules = { include: [G.Comedy, G.Animation], exclude: [G.Horror] };
  assert.equal(fitsGenres([G.Comedy, G.Drama], rules), true);
  assert.equal(fitsGenres([G.Comedy, G.Horror], rules), false);
  assert.equal(fitsGenres([G.Drama], rules), false);
  assert.equal(fitsGenres([G.Drama], { include: [], exclude: [] }), true);
});

test("differentGenres avoids your top genres", () => {
  const profile = buildTasteProfile([
    signal({ tmdbId: 1, genreIds: [G.Horror], score: 5 }),
    signal({ tmdbId: 2, genreIds: [G.Comedy], score: 4.5 }),
  ]);
  const { include, exclude } = differentGenres(profile);
  assert.ok(exclude.includes(G.Horror));
  assert.ok(!include.includes(G.Horror));
  assert.ok(!include.includes(G.Comedy));
  assert.equal(include.length, 4);
});

test("parseRuntimeLimit only accepts the offered limits", () => {
  assert.equal(parseRuntimeLimit("90"), 90);
  assert.equal(parseRuntimeLimit("120"), 120);
  assert.equal(parseRuntimeLimit("45"), null);
  assert.equal(parseRuntimeLimit(undefined), null);
});

test("weightedPick draws from the best few and skips excluded films", () => {
  const films = [{ score: 2 }, { score: 1 }, { score: 0 }];
  assert.equal(weightedPick(films, new Set(), () => 0), films[0]);
  assert.equal(weightedPick(films, new Set([films[0]]), () => 0), films[1]);
  assert.equal(weightedPick([], new Set()), null);
  assert.equal(weightedPick(films, new Set(films)), null);
  // Never returns something outside the pool, even at the top of the range.
  assert.ok(films.includes(weightedPick(films, new Set(), () => 0.9999)!));
});
