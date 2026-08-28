import { prisma } from "@/lib/prisma";
import { parseGenres } from "@/lib/movies";

const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Counts genres across a set of (movieId, movie.genres) rows, counting each
// unique movie once regardless of how many times it appears (e.g. rewatches
// in a diary). Shared by getUserStats and getYearInReview, whose entries
// have the same shape for this purpose.
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

export type UserStats = {
  totalLogged: number;
  uniqueFilms: number;
  rewatches: number;
  totalWatchMinutes: number;
  averageRating: number | null;
  ratingDistribution: { score: number; count: number }[];
  topGenres: { name: string; count: number }[];
  busiestMonth: string | null;
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const [entries, ratings] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId },
      select: { movieId: true, rewatch: true, watchedDate: true, movie: { select: { runtime: true, genres: true } } },
    }),
    prisma.rating.findMany({
      where: { userId },
      select: { score: true },
    }),
  ]);

  const uniqueMovieIds = new Set(entries.map((e) => e.movieId));
  const rewatches = entries.filter((e) => e.rewatch).length;
  const totalWatchMinutes = entries.reduce((sum, e) => sum + (e.movie.runtime ?? 0), 0);

  const averageRating =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : null;

  const ratingDistribution = RATING_BUCKETS.map((score) => ({
    score,
    count: ratings.filter((r) => r.score === score).length,
  }));

  const topGenres = topGenreCounts(entries);

  const monthCounts = new Array(12).fill(0);
  for (const entry of entries) monthCounts[entry.watchedDate.getMonth()]++;
  const maxMonthCount = Math.max(0, ...monthCounts);
  const busiestMonth = maxMonthCount > 0 ? MONTH_NAMES[monthCounts.indexOf(maxMonthCount)] : null;

  return {
    totalLogged: entries.length,
    uniqueFilms: uniqueMovieIds.size,
    rewatches,
    totalWatchMinutes,
    averageRating,
    ratingDistribution,
    topGenres,
    busiestMonth,
  };
}

export function formatWatchTime(minutes: number): string {
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}
