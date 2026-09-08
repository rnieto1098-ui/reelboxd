// Covers the arithmetic behind the profile stats page — the streak and
// window boundaries, the watched-union counting, and the crowd comparison's
// scale conversion, all of which are easy to get subtly wrong and impossible
// to eyeball on a rendered page.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHeatmap,
  compareToCrowd,
  decadeProfile,
  formatDuration,
  genreProfile,
  leaderboards,
  ratingHistogram,
  releaseYearDistribution,
  runtimeProfile,
  streakStats,
  summarize,
  watchlistHealth,
  weekdayRhythm,
  type StatsDiaryEntry,
  type StatsInput,
  type StatsMovie,
  type StatsRating,
} from "./statsCompute.ts";

const NOW = new Date("2026-09-07T12:00:00.000Z");

function movie(id: string, overrides: Partial<StatsMovie> = {}): StatsMovie {
  return {
    id,
    tmdbId: Number(id.replace(/\D/g, "")) || 1,
    title: `Film ${id}`,
    posterPath: null,
    releaseDate: "2000-01-01",
    runtime: 100,
    genres: [],
    certification: null,
    voteAverage: null,
    ...overrides,
  };
}

function movieMap(...movies: StatsMovie[]): Map<string, StatsMovie> {
  return new Map(movies.map((m) => [m.id, m]));
}

function entry(movieId: string, day: string, rewatch = false): StatsDiaryEntry {
  return { movieId, watchedDate: new Date(`${day}T00:00:00.000Z`), rewatch };
}

function rating(movieId: string, score: number, updatedAt = "2026-01-01"): StatsRating {
  return { movieId, score, updatedAt: new Date(`${updatedAt}T00:00:00.000Z`) };
}

function input(overrides: Partial<StatsInput> = {}): StatsInput {
  return {
    movieById: new Map(),
    diaryEntries: [],
    ratings: [],
    watchedMovieIds: new Set(),
    likeCount: 0,
    watchlistAddedAt: [],
    now: NOW,
    ...overrides,
  };
}

// --- summarize --------------------------------------------------------------

test("films watched counts the union of diary, ratings and undated marks", () => {
  const summary = summarize(
    input({
      movieById: movieMap(movie("m1"), movie("m2"), movie("m3")),
      diaryEntries: [entry("m1", "2026-09-01")],
      ratings: [rating("m2", 4)],
      // m1 appears in two of the three sources and must still count once.
      watchedMovieIds: new Set(["m1", "m2", "m3"]),
    })
  );
  assert.equal(summary.filmsWatched, 3);
  assert.equal(summary.entriesLogged, 1);
});

test("watch time counts every rewatch again but unlogged films only once", () => {
  const summary = summarize(
    input({
      movieById: movieMap(movie("m1", { runtime: 100 }), movie("m2", { runtime: 50 })),
      // m1 logged twice: 200 minutes. m2 rated only: 50 minutes, counted once.
      diaryEntries: [entry("m1", "2026-09-01"), entry("m1", "2026-09-02", true)],
      ratings: [rating("m2", 4)],
      watchedMovieIds: new Set(["m1", "m2"]),
    })
  );
  assert.equal(summary.watchMinutes, 250);
  assert.equal(summary.rewatches, 1);
});

test("this-year count is distinct films, not logs, and excludes other years", () => {
  const summary = summarize(
    input({
      movieById: movieMap(movie("m1"), movie("m2")),
      diaryEntries: [
        entry("m1", "2026-02-01"),
        entry("m1", "2026-03-01"),
        entry("m2", "2025-12-31"),
      ],
      watchedMovieIds: new Set(["m1", "m2"]),
    })
  );
  assert.equal(summary.filmsThisYear, 1);
});

// --- ratings ----------------------------------------------------------------

test("rating histogram reports median, mode and percentages", () => {
  const histogram = ratingHistogram([
    rating("a", 3),
    rating("b", 4),
    rating("c", 4),
    rating("d", 5),
  ]);
  assert.equal(histogram.median, 4);
  assert.equal(histogram.mostUsedScore, 4);
  const fourStar = histogram.buckets.find((b) => b.score === 4);
  assert.equal(fourStar?.count, 2);
  assert.equal(fourStar?.percent, 50);
});

test("a rater who gives everything the same score has zero deviation", () => {
  const histogram = ratingHistogram([rating("a", 4), rating("b", 4), rating("c", 4)]);
  assert.equal(histogram.deviation, 0);
  assert.equal(histogram.spreadLabel, "You rate almost everything the same");
});

test("an empty rating list yields no median, mode or label", () => {
  const histogram = ratingHistogram([]);
  assert.equal(histogram.median, null);
  assert.equal(histogram.mostUsedScore, null);
  assert.equal(histogram.spreadLabel, null);
  assert.equal(histogram.buckets.length, 10);
});

// --- crowd comparison -------------------------------------------------------

test("crowd comparison doubles stars onto TMDB's ten-point scale", () => {
  const crowd = compareToCrowd(
    [rating("m1", 5)],
    movieMap(movie("m1", { voteAverage: 6 }))
  );
  assert.equal(crowd.comparedCount, 1);
  assert.equal(crowd.championed[0].yourScore, 10);
  assert.equal(crowd.championed[0].delta, 4);
});

test("films with no community votes are skipped, not treated as zeroes", () => {
  const crowd = compareToCrowd(
    [rating("m1", 5), rating("m2", 5), rating("m3", 5)],
    movieMap(
      movie("m1", { voteAverage: 8 }),
      movie("m2", { voteAverage: null }),
      // TMDB reports 0 for a film nobody has voted on; scoring that as a
      // unanimous zero would manufacture a huge fake disagreement.
      movie("m3", { voteAverage: 0 })
    )
  );
  assert.equal(crowd.comparedCount, 1);
  assert.equal(crowd.averageDelta, 2);
});

test("championed and panned are sorted by gap size and split by direction", () => {
  const crowd = compareToCrowd(
    [rating("m1", 5), rating("m2", 4.5), rating("m3", 1), rating("m4", 3.5)],
    movieMap(
      movie("m1", { voteAverage: 5 }), // +5.0
      movie("m2", { voteAverage: 7 }), // +2.0
      movie("m3", { voteAverage: 8 }), // -6.0
      movie("m4", { voteAverage: 7 }) //   0.0
    )
  );
  assert.deepEqual(
    crowd.championed.map((t) => t.delta),
    [5, 2]
  );
  assert.deepEqual(
    crowd.panned.map((t) => t.delta),
    [-6]
  );
  assert.deepEqual(
    crowd.agreedOn.map((t) => t.tmdbId),
    [4]
  );
});

// --- streaks ----------------------------------------------------------------

test("a streak running up to today is current", () => {
  const streaks = streakStats(
    [entry("m1", "2026-09-05"), entry("m2", "2026-09-06"), entry("m3", "2026-09-07")],
    NOW
  );
  assert.equal(streaks.currentStreak, 3);
  assert.equal(streaks.longestStreak, 3);
});

test("a streak that ended yesterday is still current — a day must fully pass to break it", () => {
  const streaks = streakStats([entry("m1", "2026-09-05"), entry("m2", "2026-09-06")], NOW);
  assert.equal(streaks.currentStreak, 2);
});

test("a streak that ended two days ago is over", () => {
  const streaks = streakStats([entry("m1", "2026-09-04"), entry("m2", "2026-09-05")], NOW);
  assert.equal(streaks.currentStreak, 0);
  assert.equal(streaks.longestStreak, 2);
});

test("the longest streak is found in the past, not just at the end", () => {
  const streaks = streakStats(
    [
      entry("a", "2026-01-01"),
      entry("b", "2026-01-02"),
      entry("c", "2026-01-03"),
      entry("d", "2026-01-04"),
      entry("e", "2026-09-07"),
    ],
    NOW
  );
  assert.equal(streaks.longestStreak, 4);
  assert.equal(streaks.longestStreakEnd, "2026-01-04");
  assert.equal(streaks.currentStreak, 1);
});

test("two films on one day is one streak day, not two", () => {
  const streaks = streakStats([entry("a", "2026-09-07"), entry("b", "2026-09-07")], NOW);
  assert.equal(streaks.currentStreak, 1);
  assert.equal(streaks.busiestDay?.count, 2);
  assert.equal(streaks.averagePerActiveDay, 2);
});

test("an empty diary has no streak and no busiest day", () => {
  const streaks = streakStats([], NOW);
  assert.equal(streaks.longestStreak, 0);
  assert.equal(streaks.busiestDay, null);
});

// --- heatmap ----------------------------------------------------------------

test("the heatmap is always a full 53 x 7 grid ending on the current week", () => {
  const heatmap = buildHeatmap([entry("m1", "2026-09-07")], NOW);
  assert.equal(heatmap.weeks.length, 53);
  for (const week of heatmap.weeks) assert.equal(week.length, 7);
  // The last column is the current week, so it must contain today.
  assert.ok(heatmap.weeks[52].some((cell) => cell.day === "2026-09-07"));
  assert.equal(heatmap.totalInWindow, 1);
  assert.equal(heatmap.activeDays, 1);
});

test("watches older than the window are excluded from the heatmap totals", () => {
  const heatmap = buildHeatmap([entry("m1", "2024-01-01"), entry("m2", "2026-09-07")], NOW);
  assert.equal(heatmap.totalInWindow, 1);
});

test("the heatmap labels each month exactly once", () => {
  const heatmap = buildHeatmap([], NOW);
  // 53 weeks spans just over a year, so one month appears at both ends.
  assert.ok(heatmap.monthLabels.length >= 12);
  assert.ok(heatmap.monthLabels.length <= 14);
  const positions = heatmap.monthLabels.map((m) => m.weekIndex);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

// --- rhythm -----------------------------------------------------------------

test("weekday rhythm buckets by UTC day, Sunday first", () => {
  // 2026-09-06 is a Sunday, 2026-09-07 a Monday.
  const rhythm = weekdayRhythm([
    entry("a", "2026-09-06"),
    entry("b", "2026-09-07"),
    entry("c", "2026-09-07"),
  ]);
  assert.equal(rhythm[0].label, "Sun");
  assert.equal(rhythm[0].count, 1);
  assert.equal(rhythm[1].count, 2);
});

// --- genres, decades, runtimes ---------------------------------------------

test("genre stats count each film once and withhold thin averages", () => {
  const movies = movieMap(
    movie("m1", { genres: ["Drama", "Crime"] }),
    movie("m2", { genres: ["Drama"] }),
    movie("m3", { genres: ["Drama"] })
  );
  const genres = genreProfile(
    new Set(["m1", "m2", "m3"]),
    movies,
    [rating("m1", 5), rating("m2", 4), rating("m3", 3)]
  );
  const drama = genres.find((g) => g.name === "Drama");
  assert.equal(drama?.count, 3);
  assert.equal(drama?.averageRating, 4);
  // Crime has one rated film — below the three-film floor, so no average.
  assert.equal(genres.find((g) => g.name === "Crime")?.averageRating, null);
});

test("decades zero-fill the gaps between the oldest and newest film", () => {
  const movies = movieMap(
    movie("m1", { releaseDate: "1972-03-24" }),
    movie("m2", { releaseDate: "1999-10-15" })
  );
  const decades = decadeProfile(new Set(["m1", "m2"]), movies, []);
  assert.deepEqual(
    decades.map((d) => [d.decade, d.count]),
    [
      [1970, 1],
      [1980, 0],
      [1990, 1],
    ]
  );
});

test("release-year buckets zero-fill and count distinct films only", () => {
  const movies = movieMap(
    movie("m1", { releaseDate: "1998-01-01" }),
    movie("m2", { releaseDate: "2000-01-01" })
  );
  const buckets = releaseYearDistribution(new Set(["m1", "m2"]), movies);
  assert.deepEqual(
    buckets.map((b) => [b.year, b.count]),
    [
      [1998, 1],
      [1999, 0],
      [2000, 1],
    ]
  );
});

test("runtime buckets are half-open, so 90 minutes is not 'under 90m'", () => {
  const movies = movieMap(
    movie("m1", { runtime: 89 }),
    movie("m2", { runtime: 90 }),
    movie("m3", { runtime: 180 })
  );
  const profile = runtimeProfile(new Set(["m1", "m2", "m3"]), movies);
  assert.equal(profile.buckets[0].count, 1); // under 90m
  assert.equal(profile.buckets[1].count, 1); // 90-119m
  assert.equal(profile.buckets[4].count, 1); // 3h and up
  assert.equal(profile.longest?.runtime, 180);
  assert.equal(Math.round(profile.averageMinutes as number), 120);
});

test("films with no known runtime are left out of the runtime profile entirely", () => {
  const movies = movieMap(movie("m1", { runtime: null }), movie("m2", { runtime: 0 }));
  const profile = runtimeProfile(new Set(["m1", "m2"]), movies);
  assert.equal(profile.averageMinutes, null);
  assert.equal(profile.longest, null);
});

// --- leaderboards -----------------------------------------------------------

test("most-rewatched excludes films logged exactly once", () => {
  const movies = movieMap(movie("m1"), movie("m2"));
  const boards = leaderboards(
    [entry("m1", "2026-01-01"), entry("m1", "2026-02-01"), entry("m2", "2026-03-01")],
    [],
    movies
  );
  assert.deepEqual(
    boards.mostRewatched.map((m) => [m.tmdbId, m.watchCount]),
    [[1, 2]]
  );
});

test("equal top ratings break toward the most recently rated film", () => {
  const movies = movieMap(movie("m1"), movie("m2"));
  const boards = leaderboards(
    [],
    [rating("m1", 5, "2026-01-01"), rating("m2", 5, "2026-06-01")],
    movies
  );
  assert.deepEqual(
    boards.highestRated.map((m) => m.tmdbId),
    [2, 1]
  );
});

// --- watchlist --------------------------------------------------------------

test("watchlist health measures waits and extrapolates a clear time", () => {
  const health = watchlistHealth(
    [new Date("2025-09-07T00:00:00.000Z"), new Date("2026-09-01T00:00:00.000Z")],
    // 365 films over the past year is one a day, so two waiting films clear
    // in about two days.
    Array.from({ length: 365 }, (_, i) =>
      entry("m1", new Date(NOW.getTime() - i * 86400000).toISOString().slice(0, 10))
    ),
    NOW
  );
  assert.equal(health.size, 2);
  assert.equal(health.oldestWaitDays, 365);
  assert.equal(health.addedLast30Days, 1);
  assert.equal(health.daysToClear, 2);
});

test("an empty watchlist reports nulls rather than zeroes it can't justify", () => {
  const health = watchlistHealth([], [], NOW);
  assert.equal(health.size, 0);
  assert.equal(health.oldestWaitDays, null);
  assert.equal(health.daysToClear, null);
});

test("a watchlist with no recent watches can't estimate a clear time", () => {
  const health = watchlistHealth([new Date("2026-09-01T00:00:00.000Z")], [], NOW);
  assert.equal(health.daysToClear, null);
});

// --- formatting -------------------------------------------------------------

test("durations round to the coarsest unit that still reads true", () => {
  assert.equal(formatDuration(0), "today");
  assert.equal(formatDuration(1), "1 day");
  assert.equal(formatDuration(12), "12 days");
  assert.equal(formatDuration(35), "1 month");
  assert.equal(formatDuration(90), "3 months");
  assert.equal(formatDuration(400), "1 year");
  assert.equal(formatDuration(900), "2 years");
});
