import { prisma } from "@/lib/prisma";

/** Swaps in the user's chosen poster art for any movie that has one. */
export function applyPosterOverrides<T extends { id: number; poster_path: string | null }>(
  movies: T[],
  overrides: Map<number, string>
): T[] {
  if (overrides.size === 0) return movies;
  return movies.map((movie) =>
    overrides.has(movie.id) ? { ...movie, poster_path: overrides.get(movie.id)! } : movie
  );
}

/**
 * Looks up this user's custom poster choices for a batch of TMDB movie ids
 * (used to override the default poster_path in listing rows/grids).
 */
export async function getCustomPosterMap(
  userId: string | undefined,
  tmdbIds: number[]
): Promise<Map<number, string>> {
  if (!userId || tmdbIds.length === 0) return new Map();

  const overrides = await prisma.customPoster.findMany({
    where: { userId, movie: { tmdbId: { in: tmdbIds } } },
    include: { movie: { select: { tmdbId: true } } },
  });

  return new Map(overrides.map((o) => [o.movie.tmdbId, o.posterPath]));
}

export async function getCustomPosterForMovie(
  userId: string | undefined,
  tmdbId: number
): Promise<string | null> {
  if (!userId) return null;

  const override = await prisma.customPoster.findFirst({
    where: { userId, movie: { tmdbId } },
    select: { posterPath: true },
  });

  return override?.posterPath ?? null;
}
