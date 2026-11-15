import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cluesFor,
  compareGuess,
  computeStats,
  isDayKey,
  posterBlur,
  puzzleIndex,
  puzzleNumber,
  shareText,
  todayKey,
  type GameFilm,
} from "./dailyGame.ts";

const interstellar: GameFilm = {
  tmdbId: 157336,
  title: "Interstellar",
  year: 2014,
  runtime: 169,
  certification: "PG-13",
  genres: ["Adventure", "Drama", "Science Fiction"],
  directorName: "Christopher Nolan",
  cast: ["Matthew McConaughey", "Anne Hathaway", "Michael Caine", "Jessica Chastain", "Casey Affleck"],
};

const inception: GameFilm = {
  tmdbId: 27205,
  title: "Inception",
  year: 2010,
  runtime: 148,
  certification: "PG-13",
  genres: ["Action", "Science Fiction", "Adventure"],
  directorName: "Christopher Nolan",
  cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Ken Watanabe", "Tom Hardy", "Michael Caine"],
};

test("the puzzle day is the UTC date, and day keys are validated", () => {
  assert.equal(todayKey(new Date("2026-11-15T23:59:59.000Z")), "2026-11-15");
  assert.equal(isDayKey("2026-11-15"), true);
  for (const bad of ["2026-02-30", "2026-1-5", "today", "", null, 20261115]) {
    assert.equal(isDayKey(bad), false, String(bad));
  }
});

test("puzzles are numbered from 1 on the first day", () => {
  assert.equal(puzzleNumber("2026-11-01"), 1);
  assert.equal(puzzleNumber("2026-11-15"), 15);
  assert.equal(puzzleNumber("2027-11-01"), 366);
});

test("every film in the pool is used exactly once per pass", () => {
  const size = 37;
  const firstPass = Array.from({ length: size }, (_, i) => puzzleIndex(i + 1, size));
  assert.deepEqual([...firstPass].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i));
  // Not simply in pool order.
  assert.notDeepEqual(firstPass, Array.from({ length: size }, (_, i) => i));
  // Same answer every time it is asked.
  assert.equal(puzzleIndex(5, size), puzzleIndex(5, size));
  // The second pass is a different shuffle of the same films.
  const secondPass = Array.from({ length: size }, (_, i) => puzzleIndex(size + i + 1, size));
  assert.deepEqual([...secondPass].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i));
  assert.notDeepEqual(secondPass, firstPass);
});

test("an empty pool has no puzzle", () => {
  assert.equal(puzzleIndex(1, 0), -1);
});

test("six clues, vaguest first, never naming the film", () => {
  const clues = cluesFor(interstellar);
  assert.equal(clues.length, 6);
  assert.equal(clues[0].text, "Released in the 2010s · Adventure, Drama, Science Fiction");
  assert.equal(clues[1].text, "2h 49m · Rated PG-13");
  assert.equal(clues[2].text, "2014");
  assert.equal(clues[3].text, "Christopher Nolan");
  assert.equal(clues[4].text, "Michael Caine, Jessica Chastain and Casey Affleck");
  assert.equal(clues[5].text, "Matthew McConaughey and Anne Hathaway");
  for (const clue of clues) assert.ok(!clue.text.includes("Interstellar"));
});

test("a film with missing details still produces six clues", () => {
  const sparse: GameFilm = {
    tmdbId: 1,
    title: "Sparse",
    year: null,
    runtime: null,
    certification: null,
    genres: [],
    directorName: null,
    cast: [],
  };
  const clues = cluesFor(sparse);
  assert.equal(clues.length, 6);
  assert.equal(clues[0].text, "Release date unknown");
  for (const clue of clues.slice(1)) assert.equal(clue.text, "Not listed");
});

test("the poster sharpens with each wrong guess and is clear when finished", () => {
  const blurs = [0, 1, 2, 3, 4, 5].map((n) => posterBlur(n, false));
  for (let i = 1; i < blurs.length; i++) assert.ok(blurs[i] < blurs[i - 1]);
  assert.ok(blurs[blurs.length - 1] > 0);
  assert.equal(posterBlur(2, true), 0);
  // Out-of-range counts clamp instead of returning undefined.
  assert.equal(posterBlur(99, false), blurs[blurs.length - 1]);
  assert.equal(posterBlur(-3, false), blurs[0]);
});

test("a wrong guess reports how it compares with the answer", () => {
  const feedback = compareGuess(interstellar, inception);
  assert.equal(feedback.correct, false);
  assert.equal(feedback.year, "newer"); // the answer (2014) is newer than the guess (2010)
  assert.deepEqual(feedback.sharedGenres, ["Science Fiction", "Adventure"]);
  assert.equal(feedback.sameDirector, true);
  assert.deepEqual(feedback.sharedCast, ["Michael Caine"]);
});

test("the right guess is correct, and unknown years are reported as unknown", () => {
  assert.equal(compareGuess(interstellar, interstellar).correct, true);
  assert.equal(compareGuess(interstellar, interstellar).year, "same");
  assert.equal(compareGuess(interstellar, { ...inception, year: null }).year, "unknown");
  assert.equal(compareGuess(inception, interstellar).year, "older");
});

test("stats count wins, win rate and the spread of guesses", () => {
  const stats = computeStats(
    [
      { day: "2026-11-10", solved: true, attempts: 3 },
      { day: "2026-11-11", solved: false, attempts: 6 },
      { day: "2026-11-12", solved: true, attempts: 1 },
      { day: "2026-11-13", solved: true, attempts: 3 },
    ],
    "2026-11-13"
  );
  assert.equal(stats.played, 4);
  assert.equal(stats.won, 3);
  assert.equal(stats.winRate, 75);
  assert.deepEqual(stats.distribution, [1, 0, 2, 0, 0, 0]);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 2);
});

test("an unplayed today keeps a streak alive; a missed day ends it", () => {
  const results = [
    { day: "2026-11-11", solved: true, attempts: 2 },
    { day: "2026-11-12", solved: true, attempts: 2 },
    { day: "2026-11-13", solved: true, attempts: 2 },
  ];
  assert.equal(computeStats(results, "2026-11-14").currentStreak, 3);
  assert.equal(computeStats(results, "2026-11-15").currentStreak, 0);
  assert.equal(computeStats(results, "2026-11-15").bestStreak, 3);
});

test("a loss today ends the current streak but not the best one", () => {
  const stats = computeStats(
    [
      { day: "2026-11-12", solved: true, attempts: 2 },
      { day: "2026-11-13", solved: true, attempts: 4 },
      { day: "2026-11-14", solved: false, attempts: 6 },
    ],
    "2026-11-14"
  );
  assert.equal(stats.currentStreak, 0);
  assert.equal(stats.bestStreak, 2);
});

test("no games played is all zeroes", () => {
  const stats = computeStats([], "2026-11-14");
  assert.deepEqual(stats, {
    played: 0,
    won: 0,
    winRate: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0],
  });
});

test("the share text shows the score without spoiling the film", () => {
  assert.equal(shareText(15, 3, true), "Flixtally Daily Reel #15 3/6\n⬛⬛🟩");
  assert.equal(shareText(15, 6, false), "Flixtally Daily Reel #15 X/6\n⬛⬛⬛⬛⬛⬛");
});
