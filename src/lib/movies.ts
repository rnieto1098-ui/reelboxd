import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";

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

// Ratings/watchlist items store a foreign key to our local Movie
// cache rather than the raw TMDB id, so a movie has to be pulled from TMDB
// and cached locally the first time anyone interacts with it.
export async function ensureMovieCached(tmdbId: number) {
  const existing = await prisma.movie.findUnique({ where: { tmdbId } });
  if (existing) return existing;

  const details = await getMovieDetails(tmdbId);
  const credits = creditsFromDetails(details);

  return prisma.movie.create({
    data: {
      tmdbId: details.id,
      title: details.title,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.release_date,
      runtime: details.runtime,
      genres: details.genres.map((g) => g.name).join(", "),
      voteAverage: details.vote_average,
      popularity: details.popularity ?? null,
      ...credits,
    },
  });
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
