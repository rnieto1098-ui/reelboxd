import { prisma } from "@/lib/prisma";
import { MONTH_NAMES, topGenreCounts } from "@/lib/stats";
import { yearBounds } from "@/lib/dates";

type MovieMoment = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  watchedDate: Date;
};

export type YearInReview = {
  year: number;
  totalLogged: number;
  uniqueFilms: number;
  rewatches: number;
  totalWatchMinutes: number;
  averageRating: number | null;
  topGenres: { name: string; count: number }[];
  busiestMonth: string | null;
  firstWatch: MovieMoment | null;
  mostRecentWatch: MovieMoment | null;
  favoriteDiscovery: (MovieMoment & { score: number }) | null;
};

export async function getYearInReview(userId: string, year: number): Promise<YearInReview> {
  const { start, end } = yearBounds(year);

  const entries = await prisma.diaryEntry.findMany({
    where: { userId, watchedDate: { gte: start, lt: end } },
    orderBy: { watchedDate: "asc" },
    include: {
      movie: { select: { tmdbId: true, title: true, posterPath: true, runtime: true, genres: true } },
    },
  });

  const empty: YearInReview = {
    year,
    totalLogged: 0,
    uniqueFilms: 0,
    rewatches: 0,
    totalWatchMinutes: 0,
    averageRating: null,
    topGenres: [],
    busiestMonth: null,
    firstWatch: null,
    mostRecentWatch: null,
    favoriteDiscovery: null,
  };
  if (entries.length === 0) return empty;

  const movieIds = [...new Set(entries.map((e) => e.movieId))];
  const ratings = await prisma.rating.findMany({
    where: { userId, movieId: { in: movieIds } },
    select: { movieId: true, score: true },
  });
  const ratingByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));

  const uniqueMovieIds = new Set(movieIds);
  const rewatches = entries.filter((e) => e.rewatch).length;
  const totalWatchMinutes = entries.reduce((sum, e) => sum + (e.movie.runtime ?? 0), 0);

  // One score per unique movie, so a rewatched-and-rated film isn't
  // double-counted in the year's average.
  const scoreByMovie = new Map<string, number>();
  for (const movieId of movieIds) {
    const score = ratingByMovieId.get(movieId);
    if (score != null) scoreByMovie.set(movieId, score);
  }
  const averageRating =
    scoreByMovie.size > 0
      ? [...scoreByMovie.values()].reduce((sum, s) => sum + s, 0) / scoreByMovie.size
      : null;

  const topGenres = topGenreCounts(entries);

  const monthCounts = new Array(12).fill(0);
  for (const entry of entries) monthCounts[entry.watchedDate.getMonth()]++;
  const maxMonthCount = Math.max(0, ...monthCounts);
  const busiestMonth = maxMonthCount > 0 ? MONTH_NAMES[monthCounts.indexOf(maxMonthCount)] : null;

  const toMoment = (e: (typeof entries)[number]): MovieMoment => ({
    tmdbId: e.movie.tmdbId,
    title: e.movie.title,
    posterPath: e.movie.posterPath,
    watchedDate: e.watchedDate,
  });
  const firstWatch = toMoment(entries[0]);
  const mostRecentWatch = toMoment(entries[entries.length - 1]);

  // Highest-rated film watched for the first time this year — rewatches
  // don't count, since the point is surfacing a new discovery, not a
  // returning favorite.
  let favoriteDiscovery: (MovieMoment & { score: number }) | null = null;
  for (const entry of entries) {
    if (entry.rewatch) continue;
    const score = ratingByMovieId.get(entry.movieId);
    if (score == null) continue;
    if (!favoriteDiscovery || score > favoriteDiscovery.score) {
      favoriteDiscovery = { ...toMoment(entry), score };
    }
  }

  return {
    year,
    totalLogged: entries.length,
    uniqueFilms: uniqueMovieIds.size,
    rewatches,
    totalWatchMinutes,
    averageRating,
    topGenres,
    busiestMonth,
    firstWatch,
    mostRecentWatch,
    favoriteDiscovery,
  };
}
