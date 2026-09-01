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

export type ReleaseYearBucket = { year: number; count: number };

// Distribution of release years across every distinct film the user has
// ever logged — a rewatch doesn't count twice, since the question is "what
// eras do you watch," not "how many times."
export async function getReleaseYearDistribution(userId: string): Promise<ReleaseYearBucket[]> {
  const entries = await prisma.diaryEntry.findMany({
    where: { userId },
    select: { movieId: true, movie: { select: { releaseDate: true } } },
  });

  const seenMovieIds = new Set<string>();
  const counts = new Map<number, number>();
  for (const entry of entries) {
    if (seenMovieIds.has(entry.movieId)) continue;
    seenMovieIds.add(entry.movieId);
    const year = entry.movie.releaseDate ? Number(entry.movie.releaseDate.slice(0, 4)) : NaN;
    if (!Number.isFinite(year)) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  if (counts.size === 0) return [];

  // Zero-fill the gaps within the span so the chart reads as a real
  // timeline instead of skipping years with no watches, which would
  // visually compress decades of gaps into nothing.
  const years = [...counts.keys()];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const buckets: ReleaseYearBucket[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    buckets.push({ year: y, count: counts.get(y) ?? 0 });
  }
  return buckets;
}

export type YearMovieEntry = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watchCount: number;
  rating: number | null;
};

export type YearMovieLists = {
  mostWatched: YearMovieEntry[];
  highestRated: YearMovieEntry[];
};

const YEAR_LIST_LIMIT = 10;

// "For the year": movies logged within that calendar year specifically —
// distinct from all-time stats above. Most-watched counts rewatches within
// the year; highest-rated uses the user's current rating for each film
// (a rating isn't itself dated, so this reflects their rating now, not
// necessarily what they'd have said the day they logged it).
export async function getYearMovieLists(userId: string, year: number): Promise<YearMovieLists> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const entries = await prisma.diaryEntry.findMany({
    where: { userId, watchedDate: { gte: start, lt: end } },
    select: {
      movieId: true,
      movie: { select: { tmdbId: true, title: true, posterPath: true } },
    },
  });
  if (entries.length === 0) return { mostWatched: [], highestRated: [] };

  const watchCounts = new Map<string, number>();
  const movieById = new Map<string, { tmdbId: number; title: string; posterPath: string | null }>();
  for (const entry of entries) {
    watchCounts.set(entry.movieId, (watchCounts.get(entry.movieId) ?? 0) + 1);
    movieById.set(entry.movieId, entry.movie);
  }

  const ratings = await prisma.rating.findMany({
    where: { userId, movieId: { in: [...movieById.keys()] } },
    select: { movieId: true, score: true },
  });
  const ratingByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));

  const allEntries: YearMovieEntry[] = [...movieById.entries()].map(([movieId, movie]) => ({
    tmdbId: movie.tmdbId,
    title: movie.title,
    posterPath: movie.posterPath,
    watchCount: watchCounts.get(movieId) ?? 0,
    rating: ratingByMovieId.get(movieId) ?? null,
  }));

  const mostWatched = [...allEntries]
    .sort((a, b) => b.watchCount - a.watchCount)
    .slice(0, YEAR_LIST_LIMIT);

  const highestRated = allEntries
    .filter((e) => e.rating != null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, YEAR_LIST_LIMIT);

  return { mostWatched, highestRated };
}

export function formatWatchTime(minutes: number): string {
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes % 60}m`;
}
