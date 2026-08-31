import { prisma } from "@/lib/prisma";
import {
  getWatchProviderCatalog,
  getWatchProviders,
  type TmdbWatchProviderResults,
  type TmdbWatchProvider,
} from "@/lib/tmdb";

import { isAvailableOnServices } from "@/lib/streamingAvailability";

export { hasStreamingAvailability, isAvailableOnServices } from "@/lib/streamingAvailability";

// TMDB's watch-provider data (sourced from JustWatch) is region-specific.
// Hardcoding US for now — see project notes for how to add a region picker.
export const WATCH_REGION = "US";

const MAX_BROWSABLE_PROVIDERS = 40;

// TMDB's own display-priority ranking buries some major, well-known services
// behind dozens of niche regional/bundled "Amazon Channel"-style add-ons —
// e.g. standalone Starz and HBO Max both rank well past 100th. Pin them so
// they show up regardless of where TMDB's own ordering would otherwise put
// them.
const FEATURED_PROVIDER_IDS = [1899, 43]; // HBO Max, Starz

/** The catalog of services shown on /streaming for the user to pick their own. */
export async function getBrowsableProviders(): Promise<TmdbWatchProvider[]> {
  const catalog = await getWatchProviderCatalog(WATCH_REGION);

  const topProviders = [...catalog.results]
    .sort((a, b) => {
      const pa = a.display_priorities?.[WATCH_REGION] ?? a.display_priority ?? 999;
      const pb = b.display_priorities?.[WATCH_REGION] ?? b.display_priority ?? 999;
      return pa - pb;
    })
    .slice(0, MAX_BROWSABLE_PROVIDERS);

  const featuredMissing = FEATURED_PROVIDER_IDS.filter(
    (id) => !topProviders.some((p) => p.provider_id === id)
  )
    .map((id) => catalog.results.find((p) => p.provider_id === id))
    .filter((p): p is TmdbWatchProvider => p != null);

  return [...topProviders, ...featuredMissing];
}

export async function getUserProviderIds(userId: string | undefined): Promise<Set<number>> {
  if (!userId) return new Set();

  const services = await prisma.streamingService.findMany({
    where: { userId },
    select: { providerId: true },
  });

  return new Set(services.map((s) => s.providerId));
}

// A movie the user owns is always watchable, same as one on a subscription
// they pay for — this set is ORed into every availability check below.
export async function getUserOwnedTmdbIds(userId: string | undefined): Promise<Set<number>> {
  if (!userId) return new Set();

  const owned = await prisma.ownedItem.findMany({
    where: { userId },
    select: { movie: { select: { tmdbId: true } } },
  });

  return new Set(owned.map((o) => o.movie.tmdbId));
}

export async function getFlatrateProviders(tmdbId: number): Promise<TmdbWatchProvider[]> {
  try {
    const data = await getWatchProviders(tmdbId);
    return data.results[WATCH_REGION]?.flatrate ?? [];
  } catch {
    return [];
  }
}

export async function getWatchAvailability(tmdbId: number): Promise<TmdbWatchProviderResults> {
  try {
    const data = await getWatchProviders(tmdbId);
    return data.results[WATCH_REGION] ?? {};
  } catch {
    return {};
  }
}

const FILTER_CONCURRENCY = 6;

/**
 * Keeps only the movies available (flatrate) on at least one of the user's
 * services, or that the user owns outright — an owned movie is watchable
 * regardless of what's actually streaming, so it's never worth a TMDB
 * provider lookup.
 */
export async function filterMoviesByStreaming<T extends { id: number }>(
  movies: T[],
  userProviderIds: Set<number>,
  ownedTmdbIds: Set<number> = new Set()
): Promise<T[]> {
  if (userProviderIds.size === 0 && ownedTmdbIds.size === 0) return movies;

  const kept: T[] = [];
  for (let i = 0; i < movies.length; i += FILTER_CONCURRENCY) {
    const batch = movies.slice(i, i + FILTER_CONCURRENCY);
    const providerLists = await Promise.all(
      batch.map((m) => (ownedTmdbIds.has(m.id) ? Promise.resolve([]) : getFlatrateProviders(m.id)))
    );
    batch.forEach((movie, idx) => {
      if (ownedTmdbIds.has(movie.id) || isAvailableOnServices(providerLists[idx], userProviderIds)) {
        kept.push(movie);
      }
    });
  }
  return kept;
}

/**
 * Keeps only movies that are available to rent or buy but aren't on any
 * flatrate (subscription) service at all right now.
 *
 * There's no real "leaving soon" data available anywhere free (TMDB has no
 * departure-date field, and Reelgood/JustWatch source that from private
 * licensing-deal feeds) — this is an honest substitute: a movie that's only
 * rentable/buyable, with no subscription home, is exactly the kind of title
 * that isn't sitting on a stable ongoing streaming deal.
 */
export async function filterRentBuyOnly<T extends { id: number }>(movies: T[]): Promise<T[]> {
  const kept: T[] = [];
  for (let i = 0; i < movies.length; i += FILTER_CONCURRENCY) {
    const batch = movies.slice(i, i + FILTER_CONCURRENCY);
    const availability = await Promise.all(batch.map((m) => getWatchAvailability(m.id)));
    batch.forEach((movie, idx) => {
      const a = availability[idx];
      const hasFlatrate = (a.flatrate?.length ?? 0) > 0;
      const hasRentOrBuy = (a.rent?.length ?? 0) > 0 || (a.buy?.length ?? 0) > 0;
      if (!hasFlatrate && hasRentOrBuy) kept.push(movie);
    });
  }
  return kept;
}
