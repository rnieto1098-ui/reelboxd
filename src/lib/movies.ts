import { prisma } from "@/lib/prisma";
import { getMovieDetails, getUsCertification } from "@/lib/tmdb";

// Every movie card's hover overlay needs to know, for the signed-in viewer,
// which posters are already owned/watchlisted so it can render those icons
// highlighted instead of always starting "off". These two are the shared
// per-page lookup — call once per page load, not per card.
export async function getUserWatchlistedTmdbIds(userId: string | undefined): Promise<Set<number>> {
  if (!userId) return new Set();

  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { movie: { select: { tmdbId: true } } },
  });

  return new Set(items.map((i) => i.movie.tmdbId));
}

// Movie.genres is cached as a comma-separated string (see the `create` call
// below); this reverses that back into a clean array wherever it's read.
export function parseGenres(genres: string | null): string[] {
  return genres?.split(", ").filter(Boolean) ?? [];
}

// Bump this whenever a migration adds a Movie column derived from the TMDB
// details payload. A cache hit never refetched, so rows written before such
// a column existed kept its null forever — and for `certification` (added
// 2026-09-05) null is indistinguishable from a legitimately unrated film,
// so "PG-13 and below" silently dropped every older movie, including ones
// actually rated G. cachedAt is the only thing that can tell those apart,
// which is what it's for. Healing is per-row and one-time: a refreshed row
// gets a current cachedAt and is never refetched on this account again.
const MOVIE_CACHE_SCHEMA_EPOCH = new Date("2026-09-05T09:00:00.000Z");

export function isMovieCacheStale(cachedAt: Date): boolean {
  return cachedAt < MOVIE_CACHE_SCHEMA_EPOCH;
}

function movieFieldsFromDetails(details: Awaited<ReturnType<typeof getMovieDetails>>) {
  return {
    tmdbId: details.id,
    title: details.title,
    overview: details.overview,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    releaseDate: details.release_date,
    runtime: details.runtime,
    certification: getUsCertification(details),
    genres: details.genres.map((g) => g.name).join(", "),
    voteAverage: details.vote_average,
    popularity: details.popularity ?? null,
    ...creditsFromDetails(details),
  };
}

// Ratings/watchlist items store a foreign key to our local Movie
// cache rather than the raw TMDB id, so a movie has to be pulled from TMDB
// and cached locally the first time anyone interacts with it.
export async function ensureMovieCached(tmdbId: number) {
  const existing = await prisma.movie.findUnique({ where: { tmdbId } });
  if (existing && !isMovieCacheStale(existing.cachedAt)) return existing;

  if (existing) {
    // A refresh failing is not a reason to behave as though the movie were
    // never cached — keep serving the row we have and try again next time.
    // A first-ever fetch still throws, which every caller already handles.
    const details = await getMovieDetails(tmdbId).catch(() => null);
    if (!details) return existing;
    return prisma.movie.update({
      where: { tmdbId },
      data: { ...movieFieldsFromDetails(details), cachedAt: new Date() },
    });
  }

  const details = await getMovieDetails(tmdbId);
  return prisma.movie.create({ data: movieFieldsFromDetails(details) });
}

const CACHE_REFRESH_CONCURRENCY = 8;

// For callers that read Movie columns straight out of the database instead
// of going through ensureMovieCached per movie — they can't heal a stale
// row on their own, so they refresh the ones they need first and re-read.
export async function refreshStaleMovieCache(tmdbIds: number[]): Promise<void> {
  for (let i = 0; i < tmdbIds.length; i += CACHE_REFRESH_CONCURRENCY) {
    const batch = tmdbIds.slice(i, i + CACHE_REFRESH_CONCURRENCY);
    await Promise.all(batch.map((id) => ensureMovieCached(id).catch(() => null)));
  }
}

// Shared by ensureMovieCached (first-time caching) and the stats
// backfill (rows cached before director/cast/cinematographer names were
// tracked) — both need the exact same TMDB details -> Movie-column mapping.
function creditsFromDetails(details: Awaited<ReturnType<typeof getMovieDetails>>) {
  const director = details.credits?.crew.find((c) => c.job === "Director");
  const cinematographer = details.credits?.crew.find((c) => c.job === "Director of Photography");
  // TMDB returns cast already in billing order; top 5 is plenty of signal
  // for "movies with people you seem to like" without over-weighting a film
  // that just happens to have a huge ensemble.
  const topCast = details.credits?.cast.slice(0, 5) ?? [];

  return {
    directorId: director?.id ?? null,
    directorName: director?.name ?? null,
    topCastIds: topCast.length > 0 ? topCast.map((c) => c.id).join(",") : null,
    topCastNames: topCast.length > 0 ? topCast.map((c) => c.name).join(",") : null,
    cinematographerId: cinematographer?.id ?? null,
    cinematographerName: cinematographer?.name ?? null,
  };
}

export type MovieCreditFields = {
  id: string;
  tmdbId: number;
  directorId: number | null;
  directorName: string | null;
  topCastIds: string | null;
  topCastNames: string | null;
  cinematographerId: number | null;
  cinematographerName: string | null;
};

// Self-heals rows cached before credit names were tracked. topCastIds and
// topCastNames are always written together (see creditsFromDetails), so
// topCastIds present with topCastNames still null reliably means "cached
// before this field existed" — unlike directorId/cinematographerId, which
// are legitimately null for plenty of real movies (documentaries, shorts)
// and can't be used as the "needs backfill" signal. Only refetches from
// TMDB when actually missing, so this is a no-op after the first pass.
// Rows so old they have no topCastIds at all can't be detected here, but
// they all predate MOVIE_CACHE_SCHEMA_EPOCH, so ensureMovieCached refreshes
// them wholesale instead.
// Typed to always return the same MovieCreditFields shape on both the
// early-return and refetched paths, so callers get one consistent type.
export async function backfillMovieCredits(
  movie: MovieCreditFields
): Promise<MovieCreditFields> {
  if (movie.topCastIds == null || movie.topCastNames != null) return movie;

  const details = await getMovieDetails(movie.tmdbId);
  const credits = creditsFromDetails(details);
  return prisma.movie.update({ where: { id: movie.id }, data: credits });
}
