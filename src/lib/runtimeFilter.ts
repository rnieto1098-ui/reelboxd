import { ensureMovieCached } from "@/lib/movies";
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
  const kept: TmdbMovieSummary[] = [];
  for (let i = 0; i < movies.length; i += RUNTIME_CHECK_CONCURRENCY) {
    const batch = movies.slice(i, i + RUNTIME_CHECK_CONCURRENCY);
    const cached = await Promise.all(batch.map((m) => ensureMovieCached(m.id).catch(() => null)));
    batch.forEach((movie, idx) => {
      const runtime = cached[idx]?.runtime;
      if (runtime != null && runtime >= MIN_RECOMMENDABLE_RUNTIME_MINUTES) kept.push(movie);
    });
  }
  return kept;
}
