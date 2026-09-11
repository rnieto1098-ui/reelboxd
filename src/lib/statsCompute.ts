/**
 * Every stat on the profile stats page, computed from plain data.
 *
 * Deliberately dependency-free — no Prisma, no imports at all — for the same
 * reason as streamingAvailability.ts and parsePrompt.ts: it's the half of
 * the feature worth unit testing, and it can't be tested directly if
 * importing it drags in a database client. `getProfileStats` in stats.ts is
 * the other half: it does the loading and hands plain objects to these.
 *
 * That's also why the stats page loads its data once and slices it here
 * rather than issuing a query per stat, the way the previous version did.
 */

export type StatsMovie = {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  /** Already split by the caller, so this module needs no parsing helper. */
  genres: string[];
  certification: string | null;
  voteAverage: number | null;
};

export type StatsDiaryEntry = { movieId: string; watchedDate: Date; rewatch: boolean };
export type StatsRating = { movieId: string; score: number; updatedAt: Date };

/**
 * Everything the compute functions read, gathered once.
 *
 * `watchedMovieIds` is the app-wide definition of watched — the union of a
 * rating, a diary entry, and an undated watched mark — not just the diary.
 * The old stats page counted diary rows alone, which meant a user who
 * rated 400 films but logged 12 saw "12 films" on their own stats page.
 */
export type StatsInput = {
  movieById: Map<string, StatsMovie>;
  diaryEntries: StatsDiaryEntry[];
  ratings: StatsRating[];
  watchedMovieIds: Set<string>;
  likeCount: number;
  watchlistAddedAt: Date[];
  now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC calendar day as `YYYY-MM-DD` — the bucketing key for every date cut. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function releaseYear(movie: StatsMovie): number | null {
  const year = movie.releaseDate ? Number(movie.releaseDate.slice(0, 4)) : NaN;
  return Number.isFinite(year) ? year : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Headline numbers
// ---------------------------------------------------------------------------

export type StatsSummary = {
  filmsWatched: number;
  entriesLogged: number;
  rewatches: number;
  watchMinutes: number;
  averageRating: number | null;
  ratedCount: number;
  likeCount: number;
  watchlistSize: number;
  filmsThisYear: number;
};

export function summarize(input: StatsInput): StatsSummary {
  const { movieById, diaryEntries, ratings, watchedMovieIds, now } = input;

  // Every logged watch counts its runtime again — a rewatch really is more
  // hours in front of a screen. Films that are watched but never logged
  // (rated only, or marked watched without a date) count once, otherwise a
  // user who rates without keeping a diary sees zero hours.
  const loggedMovieIds = new Set(diaryEntries.map((e) => e.movieId));
  let watchMinutes = 0;
  for (const entry of diaryEntries) {
    watchMinutes += movieById.get(entry.movieId)?.runtime ?? 0;
  }
  for (const movieId of watchedMovieIds) {
    if (loggedMovieIds.has(movieId)) continue;
    watchMinutes += movieById.get(movieId)?.runtime ?? 0;
  }

  const thisYear = now.getUTCFullYear();
  const filmsThisYear = new Set(
    diaryEntries.filter((e) => e.watchedDate.getUTCFullYear() === thisYear).map((e) => e.movieId)
  ).size;

  return {
    filmsWatched: watchedMovieIds.size,
    entriesLogged: diaryEntries.length,
    rewatches: diaryEntries.filter((e) => e.rewatch).length,
    watchMinutes,
    averageRating: mean(ratings.map((r) => r.score)),
    ratedCount: ratings.length,
    likeCount: input.likeCount,
    watchlistSize: input.watchlistAddedAt.length,
    filmsThisYear,
  };
}

// ---------------------------------------------------------------------------
// Rating distribution
// ---------------------------------------------------------------------------

const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export type RatingHistogram = {
  buckets: { score: number; count: number; percent: number }[];
  median: number | null;
  /**
   * Population standard deviation of every rating. Low means the user rates
   * nearly everything the same, which is what `spreadLabel` names.
   */
  deviation: number | null;
  spreadLabel: string | null;
  mostUsedScore: number | null;
};

export function ratingHistogram(ratings: StatsRating[]): RatingHistogram {
  const scores = ratings.map((r) => r.score);
  const total = scores.length;
  const buckets = RATING_BUCKETS.map((score) => {
    const count = scores.filter((s) => s === score).length;
    return { score, count, percent: total > 0 ? (count / total) * 100 : 0 };
  });

  if (total === 0) {
    return { buckets, median: null, deviation: null, spreadLabel: null, mostUsedScore: null };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const avg = mean(scores) as number;
  const deviation = Math.sqrt(
    scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length
  );

  // Thresholds are in stars. Half a star of spread means almost every film
  // lands in two adjacent buckets; a full star means the scale is being
  // used end to end.
  const spreadLabel =
    deviation < 0.5
      ? "You rate almost everything the same"
      : deviation < 0.9
        ? "You keep a fairly narrow band"
        : deviation < 1.3
          ? "You use most of the scale"
          : "You swing hard in both directions";

  const busiest = [...buckets].sort((a, b) => b.count - a.count)[0];

  return {
    buckets,
    median,
    deviation,
    spreadLabel,
    mostUsedScore: busiest.count > 0 ? busiest.score : null,
  };
}

// ---------------------------------------------------------------------------
// You vs. everyone else
// ---------------------------------------------------------------------------

export type HotTake = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  yourScore: number;
  crowdScore: number;
  delta: number;
};

export type CrowdComparison = {
  comparedCount: number;
  /** Mean signed gap in TMDB points: positive means more generous than the crowd. */
  averageDelta: number | null;
  /** Mean absolute gap — how far from consensus the user sits either way. */
  contrarianIndex: number | null;
  leanLabel: string | null;
  /** Films the user rated well above consensus, biggest gap first. */
  championed: HotTake[];
  /** Films the user rated well below consensus, biggest gap first. */
  panned: HotTake[];
  agreedOn: HotTake[];
};

const HOT_TAKE_LIMIT = 5;
// A gap has to clear this many TMDB points (out of 10) before it's worth
// calling a disagreement — below it, it's rounding noise between two
// different scales, not a take.
const HOT_TAKE_MIN_DELTA = 1.5;
// Agreement is the opposite: near-identical scores on the same 10-point
// scale.
const AGREEMENT_MAX_DELTA = 0.25;

/**
 * Compares each rating against TMDB's community average.
 *
 * The user's 0.5–5 scale is doubled onto TMDB's 0–10 so the two are directly
 * subtractable. Films TMDB has no average for (or a 0, which is TMDB's way
 * of saying "nobody has voted") are skipped rather than treated as a
 * unanimous zero.
 */
export function compareToCrowd(
  ratings: StatsRating[],
  movieById: Map<string, StatsMovie>
): CrowdComparison {
  const takes: HotTake[] = [];
  for (const rating of ratings) {
    const movie = movieById.get(rating.movieId);
    if (!movie || movie.voteAverage == null || movie.voteAverage <= 0) continue;
    const yourScore = rating.score * 2;
    takes.push({
      tmdbId: movie.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      yourScore,
      crowdScore: movie.voteAverage,
      delta: yourScore - movie.voteAverage,
    });
  }

  if (takes.length === 0) {
    return {
      comparedCount: 0,
      averageDelta: null,
      contrarianIndex: null,
      leanLabel: null,
      championed: [],
      panned: [],
      agreedOn: [],
    };
  }

  const averageDelta = mean(takes.map((t) => t.delta)) as number;
  const contrarianIndex = mean(takes.map((t) => Math.abs(t.delta))) as number;

  const leanLabel =
    averageDelta > 0.75
      ? "You rate films well above the crowd"
      : averageDelta > 0.25
        ? "You're a little more generous than the crowd"
        : averageDelta < -0.75
          ? "You're a much tougher grader than the crowd"
          : averageDelta < -0.25
            ? "You're a little tougher than the crowd"
            : "You land almost exactly where the crowd does";

  const championed = takes
    .filter((t) => t.delta >= HOT_TAKE_MIN_DELTA)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, HOT_TAKE_LIMIT);
  const panned = takes
    .filter((t) => t.delta <= -HOT_TAKE_MIN_DELTA)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, HOT_TAKE_LIMIT);
  const agreedOn = takes
    .filter((t) => Math.abs(t.delta) <= AGREEMENT_MAX_DELTA)
    .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    .slice(0, HOT_TAKE_LIMIT);

  return {
    comparedCount: takes.length,
    averageDelta,
    contrarianIndex,
    leanLabel,
    championed,
    panned,
    agreedOn,
  };
}

// ---------------------------------------------------------------------------
// Watching rhythm: heatmap, streaks, weekdays, months
// ---------------------------------------------------------------------------

export type HeatmapCell = { day: string; count: number };
export type HeatmapMonthLabel = { weekIndex: number; label: string };

export type WatchHeatmap = {
  /** Columns of 7 cells, Sunday-first, oldest week first. */
  weeks: HeatmapCell[][];
  monthLabels: HeatmapMonthLabel[];
  maxCount: number;
  activeDays: number;
  totalInWindow: number;
};

const HEATMAP_WEEKS = 53;
const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTH_LABELS = MONTH_ABBREVIATIONS;
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function countsByDay(diaryEntries: StatsDiaryEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of diaryEntries) {
    const key = utcDayKey(entry.watchedDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * A year of daily watch counts laid out as a GitHub-style contribution grid.
 *
 * The window ends on the Saturday of the current week rather than on today,
 * so the final column is a whole week and the grid never has a ragged edge.
 * Days after today are still rendered (as empty cells) for the same reason —
 * they read as "not yet" rather than "nothing watched".
 */
export function buildHeatmap(diaryEntries: StatsDiaryEntry[], now: Date): WatchHeatmap {
  const counts = countsByDay(diaryEntries);

  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endOfWeek = todayUTC + (6 - new Date(todayUTC).getUTCDay()) * DAY_MS;
  const start = endOfWeek - (HEATMAP_WEEKS * 7 - 1) * DAY_MS;

  const weeks: HeatmapCell[][] = [];
  const monthLabels: HeatmapMonthLabel[] = [];
  let maxCount = 0;
  let activeDays = 0;
  let totalInWindow = 0;
  let lastLabeledMonth = -1;

  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: HeatmapCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start + (w * 7 + d) * DAY_MS);
      const day = utcDayKey(date);
      const count = date.getTime() > todayUTC ? 0 : (counts.get(day) ?? 0);
      week.push({ day, count });
      if (count > 0) {
        activeDays++;
        totalInWindow += count;
        if (count > maxCount) maxCount = count;
      }
    }
    weeks.push(week);

    // Label a column when its Sunday starts a month the previous column
    // didn't — one label per month, positioned where that month begins.
    const month = new Date(start + w * 7 * DAY_MS).getUTCMonth();
    if (month !== lastLabeledMonth) {
      monthLabels.push({ weekIndex: w, label: MONTH_ABBREVIATIONS[month] });
      lastLabeledMonth = month;
    }
  }

  return { weeks, monthLabels, maxCount, activeDays, totalInWindow };
}

export type StreakStats = {
  currentStreak: number;
  longestStreak: number;
  longestStreakEnd: string | null;
  busiestDay: { day: string; count: number } | null;
  averagePerActiveDay: number | null;
};

/**
 * Consecutive-day logging streaks, over the whole diary rather than just the
 * heatmap's window.
 *
 * The current streak counts back from today *or* yesterday — a streak isn't
 * broken until a day has fully passed without a log, so someone who hasn't
 * watched anything yet today still has theirs.
 */
export function streakStats(diaryEntries: StatsDiaryEntry[], now: Date): StreakStats {
  const counts = countsByDay(diaryEntries);
  if (counts.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      longestStreakEnd: null,
      busiestDay: null,
      averagePerActiveDay: null,
    };
  }

  const days = [...counts.keys()].sort();
  let longestStreak = 1;
  let longestStreakEnd = days[0];
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = Date.parse(days[i]) - Date.parse(days[i - 1]);
    run = gap === DAY_MS ? run + 1 : 1;
    if (run > longestStreak) {
      longestStreak = run;
      longestStreakEnd = days[i];
    }
  }

  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const lastDay = Date.parse(days[days.length - 1]);
  const daysSinceLast = (todayUTC - lastDay) / DAY_MS;
  let currentStreak = 0;
  if (daysSinceLast <= 1) {
    currentStreak = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (Date.parse(days[i]) - Date.parse(days[i - 1]) !== DAY_MS) break;
      currentStreak++;
    }
  }

  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return {
    currentStreak,
    longestStreak,
    longestStreakEnd,
    busiestDay: { day: busiest[0], count: busiest[1] },
    averagePerActiveDay: diaryEntries.length / counts.size,
  };
}

export type RhythmBucket = { label: string; count: number };

/** All-time logs per weekday (Sunday-first), matching the heatmap's rows. */
export function weekdayRhythm(diaryEntries: StatsDiaryEntry[]): RhythmBucket[] {
  const counts = new Array(7).fill(0);
  for (const entry of diaryEntries) counts[entry.watchedDate.getUTCDay()]++;
  return WEEKDAY_LABELS.map((label, i) => ({ label, count: counts[i] }));
}

/** All-time logs per calendar month, collapsing every year together. */
export function monthRhythm(diaryEntries: StatsDiaryEntry[]): RhythmBucket[] {
  const counts = new Array(12).fill(0);
  for (const entry of diaryEntries) counts[entry.watchedDate.getUTCMonth()]++;
  return MONTH_ABBREVIATIONS.map((label, i) => ({ label, count: counts[i] }));
}

// ---------------------------------------------------------------------------
// What you watch: genres, decades, runtimes, certifications
// ---------------------------------------------------------------------------

// Below this, an average is one or two films wearing a trend's clothes.
const MIN_FILMS_FOR_AVERAGE = 3;

export type GenreStat = {
  name: string;
  count: number;
  /** Null until MIN_FILMS_FOR_AVERAGE rated films exist in the genre. */
  averageRating: number | null;
  ratedCount: number;
};

/**
 * Per-genre watch counts and average ratings across every distinct film the
 * user has watched — rewatches don't inflate a genre, since the question is
 * what they watch, not how often they revisit it.
 */
export function genreProfile(
  watchedMovieIds: Set<string>,
  movieById: Map<string, StatsMovie>,
  ratings: StatsRating[],
  limit = 10
): GenreStat[] {
  const scoreByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));
  const stats = new Map<string, { count: number; total: number; rated: number }>();

  for (const movieId of watchedMovieIds) {
    const movie = movieById.get(movieId);
    if (!movie) continue;
    const score = scoreByMovieId.get(movieId);
    for (const genre of movie.genres) {
      const stat = stats.get(genre) ?? { count: 0, total: 0, rated: 0 };
      stat.count++;
      if (score != null) {
        stat.total += score;
        stat.rated++;
      }
      stats.set(genre, stat);
    }
  }

  return [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, stat]) => ({
      name,
      count: stat.count,
      ratedCount: stat.rated,
      averageRating: stat.rated >= MIN_FILMS_FOR_AVERAGE ? stat.total / stat.rated : null,
    }));
}

export type DecadeStat = {
  decade: number;
  count: number;
  averageRating: number | null;
  ratedCount: number;
};

/**
 * Watch counts by release decade, zero-filled across the full span so an
 * untouched decade shows as a real gap rather than being skipped.
 */
export function decadeProfile(
  watchedMovieIds: Set<string>,
  movieById: Map<string, StatsMovie>,
  ratings: StatsRating[]
): DecadeStat[] {
  const scoreByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));
  const stats = new Map<number, { count: number; total: number; rated: number }>();

  for (const movieId of watchedMovieIds) {
    const movie = movieById.get(movieId);
    if (!movie) continue;
    const year = releaseYear(movie);
    if (year == null) continue;
    const decade = Math.floor(year / 10) * 10;
    const stat = stats.get(decade) ?? { count: 0, total: 0, rated: 0 };
    stat.count++;
    const score = scoreByMovieId.get(movieId);
    if (score != null) {
      stat.total += score;
      stat.rated++;
    }
    stats.set(decade, stat);
  }

  if (stats.size === 0) return [];

  const decades = [...stats.keys()];
  const out: DecadeStat[] = [];
  for (let d = Math.min(...decades); d <= Math.max(...decades); d += 10) {
    const stat = stats.get(d) ?? { count: 0, total: 0, rated: 0 };
    out.push({
      decade: d,
      count: stat.count,
      ratedCount: stat.rated,
      averageRating: stat.rated >= MIN_FILMS_FOR_AVERAGE ? stat.total / stat.rated : null,
    });
  }
  return out;
}

/** The decade the user rates highest, among those they've watched enough of. */
export function favoriteDecade(decades: DecadeStat[]): DecadeStat | null {
  const eligible = decades.filter((d) => d.averageRating != null);
  if (eligible.length === 0) return null;
  return eligible.sort(
    (a, b) => (b.averageRating as number) - (a.averageRating as number) || b.count - a.count
  )[0];
}

export type RuntimeProfile = {
  buckets: { label: string; count: number }[];
  averageMinutes: number | null;
  longest: { tmdbId: number; title: string; posterPath: string | null; runtime: number } | null;
};

// Exported so the watchlist filter bar (watchlistFilters.ts) buckets runtime
// the same way this page does — one vocabulary for "how long is this film"
// across the app, rather than two slightly different bucket sets drifting
// apart over time.
export const RUNTIME_BUCKETS: { label: string; max: number }[] = [
  { label: "Under 90m", max: 90 },
  { label: "90–119m", max: 120 },
  { label: "2h–2h29", max: 150 },
  { label: "2h30–2h59", max: 180 },
  { label: "3h and up", max: Infinity },
];

/** Which RUNTIME_BUCKETS label a runtime falls into, or null if unknown. */
export function runtimeBucketLabel(runtime: number | null | undefined): string | null {
  if (!runtime || runtime <= 0) return null;
  return RUNTIME_BUCKETS.find((b) => runtime < b.max)?.label ?? null;
}

export function runtimeProfile(
  watchedMovieIds: Set<string>,
  movieById: Map<string, StatsMovie>
): RuntimeProfile {
  const buckets = RUNTIME_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  const runtimes: number[] = [];
  let longest: RuntimeProfile["longest"] = null;

  for (const movieId of watchedMovieIds) {
    const movie = movieById.get(movieId);
    if (!movie?.runtime || movie.runtime <= 0) continue;
    runtimes.push(movie.runtime);
    buckets[RUNTIME_BUCKETS.findIndex((b) => b.label === runtimeBucketLabel(movie.runtime))].count++;
    if (!longest || movie.runtime > longest.runtime) {
      longest = {
        tmdbId: movie.tmdbId,
        title: movie.title,
        posterPath: movie.posterPath,
        runtime: movie.runtime,
      };
    }
  }

  return { buckets, averageMinutes: mean(runtimes), longest };
}

// Ordered by how restrictive the rating is, so the bars read as a spectrum
// rather than as a leaderboard. Anything TMDB reports that isn't on this
// list (foreign boards, oddities) lands at the end, alphabetically. Exported
// for the same reason as RUNTIME_BUCKETS above — the watchlist filter bar
// orders its rating dropdown the same way.
export const CERTIFICATION_ORDER = ["G", "PG", "PG-13", "R", "NC-17", "NR"];

export function certificationProfile(
  watchedMovieIds: Set<string>,
  movieById: Map<string, StatsMovie>
): RhythmBucket[] {
  const counts = new Map<string, number>();
  for (const movieId of watchedMovieIds) {
    const cert = movieById.get(movieId)?.certification;
    if (!cert) continue;
    counts.set(cert, (counts.get(cert) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      const ia = CERTIFICATION_ORDER.indexOf(a[0]);
      const ib = CERTIFICATION_ORDER.indexOf(b[0]);
      if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
      return a[0].localeCompare(b[0]);
    })
    .map(([label, count]) => ({ label, count }));
}

// ---------------------------------------------------------------------------
// Release-year timeline
// ---------------------------------------------------------------------------

export type ReleaseYearBucket = { year: number; count: number };

/**
 * Distinct watched films per release year, zero-filled across the span so
 * the chart reads as a real timeline instead of compressing decades of gaps
 * into nothing.
 */
export function releaseYearDistribution(
  watchedMovieIds: Set<string>,
  movieById: Map<string, StatsMovie>
): ReleaseYearBucket[] {
  const counts = new Map<number, number>();
  for (const movieId of watchedMovieIds) {
    const movie = movieById.get(movieId);
    if (!movie) continue;
    const year = releaseYear(movie);
    if (year == null) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const years = [...counts.keys()];
  const buckets: ReleaseYearBucket[] = [];
  for (let y = Math.min(...years); y <= Math.max(...years); y++) {
    buckets.push({ year: y, count: counts.get(y) ?? 0 });
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Film leaderboards
// ---------------------------------------------------------------------------

export type RankedMovie = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watchCount: number;
  rating: number | null;
};

const LEADERBOARD_LIMIT = 8;

export type Leaderboards = {
  mostRewatched: RankedMovie[];
  highestRated: RankedMovie[];
};

/**
 * All-time top films. Most-rewatched only includes films logged more than
 * once — a list of things watched exactly once isn't a rewatch list. Ties in
 * highest-rated break toward the most recently rated film, so the list
 * changes as the user keeps rating rather than freezing on whichever 5★
 * happened to be alphabetically first.
 */
export function leaderboards(
  diaryEntries: StatsDiaryEntry[],
  ratings: StatsRating[],
  movieById: Map<string, StatsMovie>
): Leaderboards {
  const watchCounts = new Map<string, number>();
  for (const entry of diaryEntries) {
    watchCounts.set(entry.movieId, (watchCounts.get(entry.movieId) ?? 0) + 1);
  }
  const scoreByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));

  const toRanked = (movieId: string): RankedMovie | null => {
    const movie = movieById.get(movieId);
    if (!movie) return null;
    return {
      tmdbId: movie.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      watchCount: watchCounts.get(movieId) ?? 0,
      rating: scoreByMovieId.get(movieId) ?? null,
    };
  };

  const mostRewatched = [...watchCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LEADERBOARD_LIMIT)
    .map(([movieId]) => toRanked(movieId))
    .filter((m): m is RankedMovie => m != null);

  const highestRated = [...ratings]
    .sort((a, b) => b.score - a.score || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, LEADERBOARD_LIMIT)
    .map((r) => toRanked(r.movieId))
    .filter((m): m is RankedMovie => m != null);

  return { mostRewatched, highestRated };
}

// ---------------------------------------------------------------------------
// Watchlist backlog
// ---------------------------------------------------------------------------

export type WatchlistHealth = {
  size: number;
  /** Days the oldest still-unwatched item has been waiting. */
  oldestWaitDays: number | null;
  averageWaitDays: number | null;
  addedLast30Days: number;
  /**
   * How long the backlog would take at the user's current pace, in days.
   * Null when there's no pace to extrapolate from.
   */
  daysToClear: number | null;
};

const RECENT_WINDOW_DAYS = 30;
// The window the clear-rate pace is measured over. A year smooths out a
// binge week without being so long that a lapsed account looks active.
const PACE_WINDOW_DAYS = 365;

export function watchlistHealth(
  watchlistAddedAt: Date[],
  diaryEntries: StatsDiaryEntry[],
  now: Date
): WatchlistHealth {
  const size = watchlistAddedAt.length;
  if (size === 0) {
    return {
      size: 0,
      oldestWaitDays: null,
      averageWaitDays: null,
      addedLast30Days: 0,
      daysToClear: null,
    };
  }

  const waits = watchlistAddedAt.map((added) => (now.getTime() - added.getTime()) / DAY_MS);
  const paceCutoff = now.getTime() - PACE_WINDOW_DAYS * DAY_MS;
  const recentWatches = diaryEntries.filter((e) => e.watchedDate.getTime() >= paceCutoff).length;
  const perDay = recentWatches / PACE_WINDOW_DAYS;

  return {
    size,
    oldestWaitDays: Math.floor(Math.max(...waits)),
    averageWaitDays: Math.round(mean(waits) as number),
    addedLast30Days: waits.filter((w) => w <= RECENT_WINDOW_DAYS).length,
    daysToClear: perDay > 0 ? Math.round(size / perDay) : null,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers shared by the page
// ---------------------------------------------------------------------------

export function formatWatchTime(minutes: number): string {
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}

/** "3 years", "8 months", "12 days" — the coarsest unit that still reads true. */
export function formatDuration(days: number): string {
  if (days >= 730) return `${Math.round(days / 365)} years`;
  if (days >= 365) return "1 year";
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 30) return "1 month";
  if (days <= 1) return days === 1 ? "1 day" : "today";
  return `${days} days`;
}

/** "Mar 14, 2026" from a `YYYY-MM-DD` key, without re-entering local time. */
export function formatDayKey(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${MONTH_ABBREVIATIONS[month - 1]} ${date}, ${year}`;
}
