import { prisma } from "@/lib/prisma";
import { ensureMovieCached, movieNeedsRefresh } from "@/lib/movies";
import type { TmdbMovieSummary } from "@/lib/tmdb";

// Nothing under this length gets algorithmically suggested anywhere in the
// app (homepage rows, Recommend Me, "More like this", ...) — shorts and
// featurette-length titles reading like a full recommendation next to a
// two-hour film was worth a hard floor rather than a per-page opt-in.
export const MIN_RECOMMENDABLE_RUNTIME_MINUTES = 45;

const RUNTIME_CHECK_CONCURRENCY = 8;

/**
 * Drops anything under MIN_RECOMMENDABLE_RUNTIME_MINUTES from a list of
 * algorithmically-suggested movies. TMDB's list/discover/similar/trending
 * endpoints never return runtime themselves — only a movie's own
 * /movie/{id} details do — so this always needs a real per-movie lookup.
 * ensureMovieCached caches the result locally, so this is a real TMDB call
 * only the first time any given movie is looked at anywhere in the app,
 * not on every request.
 *
 * A movie whose runtime can't be determined (a lookup failure, or TMDB
 * simply not having the data) is excluded too, rather than risk
 * recommending something that turns out to be a short.
 */
export async function excludeShortFilms(
  movies: TmdbMovieSummary[]
): Promise<TmdbMovieSummary[]> {
  if (movies.length === 0) return [];

  // One query for every film that is already cached and settled, instead of
  // a separate lookup per film. A home page load checks several hundred
  // films this way; nearly all of them are cached, so this replaces several
  // hundred round trips to the database with one.
  const cachedRows = await prisma.movie.findMany({
    where: { tmdbId: { in: movies.map((m) => m.id) } },
    select: { tmdbId: true, runtime: true, releaseDate: true, cachedAt: true },
  });
  const runtimeById = new Map<number, number | null>();
  for (const row of cachedRows) {
    // Rows that are due a refresh go through ensureMovieCached below, which
    // is what refreshes them.
    if (!movieNeedsRefresh(row)) runtimeById.set(row.tmdbId, row.runtime);
  }

  // Only films not cached yet (or due a refresh) need the per-film path,
  // which fetches from TMDB the first time anyone looks at a film.
  const missing = movies.filter((m) => !runtimeById.has(m.id));
  for (let i = 0; i < missing.length; i += RUNTIME_CHECK_CONCURRENCY) {
    const batch = missing.slice(i, i + RUNTIME_CHECK_CONCURRENCY);
    const fetched = await Promise.all(batch.map((m) => ensureMovieCached(m.id).catch(() => null)));
    batch.forEach((movie, idx) => runtimeById.set(movie.id, fetched[idx]?.runtime ?? null));
  }

  return movies.filter((movie) => {
    const runtime = runtimeById.get(movie.id);
    return runtime != null && runtime >= MIN_RECOMMENDABLE_RUNTIME_MINUTES;
  });
}
