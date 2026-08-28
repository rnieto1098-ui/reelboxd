import { prisma } from "@/lib/prisma";
import {
  discoverMovies,
  discoverMoviesByGenre,
  type TmdbGenre,
  type TmdbMovieSummary,
} from "@/lib/tmdb";
import { parseGenres } from "@/lib/movies";

// A rating at or above this counts as the user "liking" the movie, and
// contributes to which genres/directors/cast we chase recommendations in.
const LIKED_THRESHOLD = 3.5;
const RESULT_COUNT = 12;
// Reserve roughly half the results for "movies with people you seem to
// like," so a strong genre match can't crowd out director/cast overlap
// entirely — genre alone fills whatever's left over.
const PEOPLE_RESULT_CAP = 6;
const TOP_DIRECTOR_COUNT = 2;
const TOP_CAST_COUNT = 3;

// Sums liked-rating scores per TMDB person id from a movie field that's
// either a single id (director) or a comma-separated list (top cast).
function scorePeople(
  likedRatings: { score: number; movie: { directorId: number | null; topCastIds: string | null } }[],
  pick: (movie: { directorId: number | null; topCastIds: string | null }) => number[]
): Map<number, number> {
  const scores = new Map<number, number>();
  for (const rating of likedRatings) {
    for (const personId of pick(rating.movie)) {
      scores.set(personId, (scores.get(personId) ?? 0) + rating.score);
    }
  }
  return scores;
}

function topIds(scores: Map<number, number>, count: number): number[] {
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([id]) => id);
}

export async function getWatchedTmdbIds(userId: string | undefined): Promise<Set<number>> {
  if (!userId) return new Set();

  const ratings = await prisma.rating.findMany({
    where: { userId },
    select: { movie: { select: { tmdbId: true } } },
  });

  return new Set(ratings.map((r) => r.movie.tmdbId));
}

/**
 * Recommends movies by looking at the genres of movies the user rated
 * highly (weighted by their score), then pulling currently-popular movies
 * in their top genres that they haven't already watched.
 */
export async function getRecommendationsForUser(
  userId: string | undefined,
  watchedTmdbIds: Set<number>,
  allGenres: TmdbGenre[]
): Promise<TmdbMovieSummary[]> {
  if (!userId) return [];

  const likedRatings = await prisma.rating.findMany({
    where: { userId, score: { gte: LIKED_THRESHOLD } },
    include: { movie: true },
  });

  if (likedRatings.length === 0) return [];

  const genreScores = new Map<string, number>();
  for (const rating of likedRatings) {
    const genres = parseGenres(rating.movie.genres);
    for (const genre of genres) {
      genreScores.set(genre, (genreScores.get(genre) ?? 0) + rating.score);
    }
  }

  const topGenreNames = [...genreScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const genreIds = topGenreNames
    .map((name) => allGenres.find((g) => g.name === name)?.id)
    .filter((id): id is number => id != null);

  const topDirectorIds = topIds(
    scorePeople(likedRatings, (m) => (m.directorId != null ? [m.directorId] : [])),
    TOP_DIRECTOR_COUNT
  );
  const topCastIds = topIds(
    scorePeople(likedRatings, (m) => m.topCastIds?.split(",").map(Number) ?? []),
    TOP_CAST_COUNT
  );

  if (genreIds.length === 0 && topDirectorIds.length === 0 && topCastIds.length === 0) return [];

  const seen = new Set(watchedTmdbIds);
  const results: TmdbMovieSummary[] = [];

  function addFromPage(movies: TmdbMovieSummary[], cap: number) {
    for (const movie of movies) {
      if (results.length >= cap) break;
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      results.push(movie);
    }
  }

  // Director/cast overlap first, capped well below RESULT_COUNT so genre
  // still gets a fair share of the row even for someone with strong,
  // consistent people-signal.
  for (const directorId of topDirectorIds) {
    if (results.length >= PEOPLE_RESULT_CAP) break;
    const page = await discoverMovies({ crewId: directorId });
    addFromPage(page.results, PEOPLE_RESULT_CAP);
  }
  for (const castId of topCastIds) {
    if (results.length >= PEOPLE_RESULT_CAP) break;
    const page = await discoverMovies({ castId });
    addFromPage(page.results, PEOPLE_RESULT_CAP);
  }

  for (const genreId of genreIds) {
    if (results.length >= RESULT_COUNT) break;
    const page = await discoverMoviesByGenre(genreId);
    addFromPage(page.results, RESULT_COUNT);
  }

  return results;
}
