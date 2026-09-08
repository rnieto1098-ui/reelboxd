import { prisma } from "@/lib/prisma";
import { parseGenres } from "@/lib/movies";
import {
  buildHeatmap,
  certificationProfile,
  compareToCrowd,
  decadeProfile,
  favoriteDecade,
  genreProfile,
  leaderboards,
  ratingHistogram,
  releaseYearDistribution,
  runtimeProfile,
  streakStats,
  summarize,
  watchlistHealth,
  weekdayRhythm,
  monthRhythm,
  type StatsInput,
  type StatsMovie,
} from "@/lib/statsCompute";

export { formatWatchTime } from "@/lib/statsCompute";
export type { ReleaseYearBucket, RankedMovie } from "@/lib/statsCompute";

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Counts genres across a set of (movieId, movie.genres) rows, counting each
// unique movie once regardless of how many times it appears (e.g. rewatches
// in a diary). Used by getYearInReview, whose entries have this shape.
export function topGenreCounts(
  entries: { movieId: string; movie: { genres: string | null } }[],
  limit = 5
): { name: string; count: number }[] {
  const genreCounts = new Map<string, number>();
  const seenMovieIds = new Set<string>();
  for (const entry of entries) {
    if (seenMovieIds.has(entry.movieId)) continue;
    seenMovieIds.add(entry.movieId);
    for (const genre of parseGenres(entry.movie.genres)) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  return [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

const STATS_MOVIE_SELECT = {
  id: true,
  tmdbId: true,
  title: true,
  posterPath: true,
  releaseDate: true,
  runtime: true,
  genres: true,
  certification: true,
  voteAverage: true,
} as const;

export type ProfileStats = ReturnType<typeof computeProfileStats>;

function computeProfileStats(input: StatsInput) {
  const { movieById, diaryEntries, ratings, watchedMovieIds, now } = input;

  const decades = decadeProfile(watchedMovieIds, movieById, ratings);

  return {
    summary: summarize(input),
    ratings: ratingHistogram(ratings),
    crowd: compareToCrowd(ratings, movieById),
    heatmap: buildHeatmap(diaryEntries, now),
    streaks: streakStats(diaryEntries, now),
    weekdays: weekdayRhythm(diaryEntries),
    months: monthRhythm(diaryEntries),
    genres: genreProfile(watchedMovieIds, movieById, ratings),
    decades,
    favoriteDecade: favoriteDecade(decades),
    runtimes: runtimeProfile(watchedMovieIds, movieById),
    certifications: certificationProfile(watchedMovieIds, movieById),
    releaseYears: releaseYearDistribution(watchedMovieIds, movieById),
    leaderboards: leaderboards(diaryEntries, ratings, movieById),
    watchlist: watchlistHealth(input.watchlistAddedAt, diaryEntries, now),
  };
}

/**
 * Loads everything the stats page needs in one pass, then computes every cut
 * from it in memory.
 *
 * The page shows a dozen different views of the same three tables, and the
 * previous version queried the diary separately for each one. Reading it
 * once costs a single round trip no matter how many stats get added on top,
 * and keeps every number on the page derived from an identical snapshot —
 * two queries a second apart could otherwise disagree with each other.
 *
 * `now` is a parameter so the date-relative stats (streaks, the heatmap
 * window, watchlist ages) are pinnable in tests.
 */
export async function getProfileStats(userId: string, now: Date = new Date()): Promise<ProfileStats> {
  const [diaryRows, ratingRows, watchedRows, likeCount, watchlistRows] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId },
      select: { movieId: true, watchedDate: true, rewatch: true, movie: { select: STATS_MOVIE_SELECT } },
    }),
    prisma.rating.findMany({
      where: { userId },
      select: { movieId: true, score: true, updatedAt: true, movie: { select: STATS_MOVIE_SELECT } },
    }),
    prisma.watchedItem.findMany({
      where: { userId },
      select: { movieId: true, movie: { select: STATS_MOVIE_SELECT } },
    }),
    prisma.like.count({ where: { userId } }),
    prisma.watchlistItem.findMany({ where: { userId }, select: { addedAt: true } }),
  ]);

  const movieById = new Map<string, StatsMovie>();
  for (const row of [...diaryRows, ...ratingRows, ...watchedRows]) {
    // Genres are split here rather than inside statsCompute so that module
    // stays import-free and therefore unit-testable.
    movieById.set(row.movie.id, { ...row.movie, genres: parseGenres(row.movie.genres) });
  }

  // The app-wide definition of watched, matching getWatchedTmdbIds in
  // recommendations.ts: a rating, a dated diary entry, or an undated mark
  // each count on their own.
  const watchedMovieIds = new Set([
    ...diaryRows.map((r) => r.movieId),
    ...ratingRows.map((r) => r.movieId),
    ...watchedRows.map((r) => r.movieId),
  ]);

  return computeProfileStats({
    movieById,
    diaryEntries: diaryRows.map((r) => ({
      movieId: r.movieId,
      watchedDate: r.watchedDate,
      rewatch: r.rewatch,
    })),
    ratings: ratingRows.map((r) => ({
      movieId: r.movieId,
      score: r.score,
      updatedAt: r.updatedAt,
    })),
    watchedMovieIds,
    likeCount,
    watchlistAddedAt: watchlistRows.map((r) => r.addedAt),
    now,
  });
}
