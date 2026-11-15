// The rules of the daily game ("Daily Reel"), as pure functions: which film
// is today's, what each clue says, how a guess compares with the answer, and
// how a streak is counted. No database or network imports, so all of it can
// be unit tested directly with `node --test`.
//
// The game: one mystery film per UTC day, the same for everyone. You get six
// guesses. You start with a heavily blurred poster and one clue; each wrong
// guess sharpens the poster and unlocks the next clue, and tells you how
// your guess compares (older or newer, shared genres, same director, shared
// cast).

export const GAME_KEY = "daily-reel";
export const MAX_GUESSES = 6;

// Puzzle #1. Every later day is counted from here.
const FIRST_DAY = "2026-11-01";
const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Today's puzzle day as "YYYY-MM-DD", in UTC so it is the same worldwide. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True for a real calendar date in "YYYY-MM-DD" form. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 1 for the first puzzle day, 2 for the next, and so on. */
export function puzzleNumber(day: string): number {
  const days = Math.round(
    (Date.parse(`${day}T00:00:00.000Z`) - Date.parse(`${FIRST_DAY}T00:00:00.000Z`)) / DAY_MS
  );
  return days + 1;
}

// A small, fast, well-known seeded random number generator (mulberry32).
// The same seed always yields the same sequence, which is what makes the
// puzzle order repeatable without storing it anywhere.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which film in the pool belongs to a given puzzle number.
 *
 * The pool is walked in a fixed shuffled order (a seeded Fisher-Yates
 * shuffle), so consecutive days feel unrelated and every film is used once
 * before any repeats. Each pass through the pool is shuffled differently.
 */
export function puzzleIndex(number: number, poolSize: number): number {
  if (poolSize <= 0) return -1;
  const n = Math.max(1, Math.floor(number)) - 1;
  const cycle = Math.floor(n / poolSize);
  const position = n % poolSize;

  const order = Array.from({ length: poolSize }, (_, i) => i);
  const random = seededRandom(0x5eed + cycle * 7919);
  for (let i = poolSize - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[position];
}

// What the game needs to know about a film, whether it is the answer or a
// guess. Mirrors the columns of the local Movie cache.
export type GameFilm = {
  tmdbId: number;
  title: string;
  year: number | null;
  runtime: number | null;
  certification: string | null;
  genres: string[];
  directorName: string | null;
  cast: string[];
};

export type Clue = { label: string; text: string };

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The six clues for a film, vaguest first. Clue 1 is shown from the start;
 * each wrong guess unlocks the next. A film missing a detail (no listed
 * director, say) still gets six clues: that slot says the detail isn't
 * listed, so the count and the pacing stay the same for every puzzle.
 */
export function cluesFor(film: GameFilm): Clue[] {
  const decade = film.year != null ? `${Math.floor(film.year / 10) * 10}s` : null;
  const supporting = film.cast.slice(2, 5);
  const leads = film.cast.slice(0, 2);
  return [
    {
      label: "Era and genre",
      text: [
        decade ? `Released in the ${decade}` : "Release date unknown",
        film.genres.length > 0 ? film.genres.join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: "Runtime and rating",
      text:
        [
          film.runtime ? formatRuntime(film.runtime) : null,
          film.certification ? `Rated ${film.certification}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "Not listed",
    },
    { label: "Year", text: film.year != null ? String(film.year) : "Not listed" },
    { label: "Director", text: film.directorName ?? "Not listed" },
    {
      label: "Supporting cast",
      text: supporting.length > 0 ? joinNames(supporting) : "Not listed",
    },
    { label: "Starring", text: leads.length > 0 ? joinNames(leads) : "Not listed" },
  ];
}

/**
 * How blurred the poster is, in pixels, after a number of wrong guesses.
 * Nearly unreadable at first, almost clear by the last guess, and fully
 * clear once the game is over.
 */
export function posterBlur(wrongGuesses: number, finished: boolean): number {
  if (finished) return 0;
  const steps = [26, 19, 13, 9, 6, 3];
  return steps[Math.max(0, Math.min(steps.length - 1, wrongGuesses))];
}

export type GuessFeedback = {
  correct: boolean;
  // Where the answer sits relative to the guess. "newer" means the mystery
  // film came out after the film that was guessed.
  year: "older" | "newer" | "same" | "unknown";
  sharedGenres: string[];
  sameDirector: boolean;
  sharedCast: string[];
};

export function compareGuess(answer: GameFilm, guess: GameFilm): GuessFeedback {
  const lower = (names: string[]) => new Set(names.map((n) => n.toLowerCase()));
  const answerGenres = lower(answer.genres);
  const answerCast = lower(answer.cast);
  return {
    correct: answer.tmdbId === guess.tmdbId,
    year:
      answer.year == null || guess.year == null
        ? "unknown"
        : answer.year === guess.year
          ? "same"
          : answer.year > guess.year
            ? "newer"
            : "older",
    sharedGenres: guess.genres.filter((g) => answerGenres.has(g.toLowerCase())),
    sameDirector:
      !!answer.directorName &&
      !!guess.directorName &&
      answer.directorName.toLowerCase() === guess.directorName.toLowerCase(),
    sharedCast: guess.cast.filter((c) => answerCast.has(c.toLowerCase())),
  };
}

export type GameStats = {
  played: number;
  won: number;
  winRate: number; // 0-100, whole number
  currentStreak: number;
  bestStreak: number;
  // Wins by number of guesses taken: index 0 is "solved in 1".
  distribution: number[];
};

/**
 * Totals and streaks from a player's finished games.
 *
 * A streak is consecutive days *won*. The current streak counts back from
 * today, or from yesterday if today's puzzle hasn't been played yet: an
 * unplayed today doesn't break a streak, a missed or lost day does.
 */
export function computeStats(
  results: { day: string; solved: boolean; attempts: number }[],
  today: string = todayKey()
): GameStats {
  const byDay = new Map(results.map((r) => [r.day, r]));
  const played = byDay.size;
  const wins = [...byDay.values()].filter((r) => r.solved);

  const distribution = Array.from({ length: MAX_GUESSES }, () => 0);
  for (const win of wins) {
    const slot = Math.max(1, Math.min(MAX_GUESSES, win.attempts)) - 1;
    distribution[slot]++;
  }

  const previousDay = (day: string) =>
    new Date(Date.parse(`${day}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);

  let cursor = byDay.has(today) ? today : previousDay(today);
  let currentStreak = 0;
  while (byDay.get(cursor)?.solved) {
    currentStreak++;
    cursor = previousDay(cursor);
  }

  let bestStreak = 0;
  let run = 0;
  let lastDay: string | null = null;
  for (const day of [...byDay.keys()].sort()) {
    const solved = byDay.get(day)!.solved;
    const consecutive = lastDay != null && previousDay(day) === lastDay;
    run = solved ? (consecutive ? run + 1 : 1) : 0;
    bestStreak = Math.max(bestStreak, run);
    lastDay = solved ? day : null;
  }

  return {
    played,
    won: wins.length,
    winRate: played > 0 ? Math.round((wins.length / played) * 100) : 0,
    currentStreak,
    bestStreak,
    distribution,
  };
}

/**
 * The text copied by "Share": the puzzle number, the score, and one square
 * per guess (green for the winning one), with no spoilers.
 */
export function shareText(number: number, guessesUsed: number, solved: boolean): string {
  const squares = Array.from({ length: guessesUsed }, (_, i) =>
    solved && i === guessesUsed - 1 ? "🟩" : "⬛"
  ).join("");
  return `Flixtally Daily Reel #${number} ${solved ? guessesUsed : "X"}/${MAX_GUESSES}\n${squares}`;
}
