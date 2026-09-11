// Relative, not "@/lib/statsCompute" — the "@/*" path alias only resolves
// under Next's own module resolution (tsconfig paths), not plain
// `node --test`, which is how this file's own tests run.
import { CERTIFICATION_ORDER, RUNTIME_BUCKETS, runtimeBucketLabel } from "./statsCompute.ts";

/**
 * The watchlist page's filter-by-attribute logic (genre, director, runtime,
 * certification) — separate from availability filtering (on/off/owned/a
 * specific service), which depends on live provider data fetched in
 * watchlist/page.tsx and stays there.
 *
 * Kept dependency-free apart from the two shared constants above, so this
 * can be unit tested directly the same way statsCompute.ts is — no Prisma,
 * no Next.js imports.
 */

export type FilterableMovie = {
  runtime: number | null;
  genres: string[];
  directorId: number | null;
  directorName: string | null;
  certification: string | null;
};

export type WatchlistFilters = {
  genre: string | null;
  directorId: number | null;
  runtimeBucket: string | null;
  certification: string | null;
};

export const NO_FILTERS: WatchlistFilters = {
  genre: null,
  directorId: null,
  runtimeBucket: null,
  certification: null,
};

export function hasActiveFilters(filters: WatchlistFilters): boolean {
  return Object.values(filters).some((v) => v != null);
}

/** Whether a movie satisfies every currently-active filter (AND, not OR). */
export function matchesFilters(movie: FilterableMovie, filters: WatchlistFilters): boolean {
  if (filters.genre != null && !movie.genres.includes(filters.genre)) return false;
  if (filters.directorId != null && movie.directorId !== filters.directorId) return false;
  if (filters.runtimeBucket != null && runtimeBucketLabel(movie.runtime) !== filters.runtimeBucket) {
    return false;
  }
  if (filters.certification != null && movie.certification !== filters.certification) return false;
  return true;
}

export type Facet<T> = { value: T; label: string; count: number };

/**
 * Every value a dropdown offers, plus how many watchlist items it would
 * currently match — always computed from the *whole* watchlist regardless
 * of other active filters, so switching one dropdown never makes another's
 * options shift under the user (same convention as the on/off services
 * count on this page, which is also computed against the unfiltered list).
 */
export function genreFacets(movies: FilterableMovie[]): Facet<string>[] {
  const counts = new Map<string, number>();
  for (const movie of movies) {
    for (const genre of movie.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ value: label, label, count }));
}

export function directorFacets(movies: FilterableMovie[]): Facet<number>[] {
  const counts = new Map<number, { name: string; count: number }>();
  for (const movie of movies) {
    if (movie.directorId == null || !movie.directorName) continue;
    const existing = counts.get(movie.directorId);
    if (existing) existing.count++;
    else counts.set(movie.directorId, { name: movie.directorName, count: 1 });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
    .map(([id, { name, count }]) => ({ value: id, label: name, count }));
}

export function runtimeFacets(movies: FilterableMovie[]): Facet<string>[] {
  const counts = new Map<string, number>();
  for (const movie of movies) {
    const label = runtimeBucketLabel(movie.runtime);
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // In RUNTIME_BUCKETS' own order (shortest to longest) rather than by
  // count — a length filter should read like a scale, not a leaderboard.
  return RUNTIME_BUCKETS.map((b) => ({ value: b.label, label: b.label, count: counts.get(b.label) ?? 0 })).filter(
    (f) => f.count > 0
  );
}

export function certificationFacets(movies: FilterableMovie[]): Facet<string>[] {
  const counts = new Map<string, number>();
  for (const movie of movies) {
    if (movie.certification) counts.set(movie.certification, (counts.get(movie.certification) ?? 0) + 1);
  }
  const known = CERTIFICATION_ORDER.filter((c) => counts.has(c)).map((c) => ({
    value: c,
    label: c,
    count: counts.get(c)!,
  }));
  const other = [...counts.entries()]
    .filter(([c]) => !CERTIFICATION_ORDER.includes(c))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ value: label, label, count }));
  return [...known, ...other];
}
