import { prisma } from "@/lib/prisma";
import { getFlatrateProviders } from "@/lib/streaming";

const SNAPSHOT_CONCURRENCY = 6;

// How far back "Recently added" looks on the homepage — keeps the row from
// permanently showing a movie that was added once, months ago, and never
// revisited.
export const RECENTLY_ADDED_WINDOW_DAYS = 21;

function parseProviderIds(stored: string): Set<number> {
  return new Set(
    stored
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  );
}

/**
 * For every movie that's ever landed on someone's watchlist or owned list,
 * fetches its current flatrate providers and diffs against the last known
 * snapshot (see MovieProviderSnapshot). Any provider present today that
 * wasn't in the last snapshot gets recorded as a ProviderAddition — TMDB
 * itself has no "date added" field, so this diff-against-yesterday is the
 * only way to build that history, and it only knows about additions from
 * whenever this job first started running.
 *
 * A movie with no prior snapshot (first time it's ever been scanned) just
 * gets seeded silently — there's nothing to diff against yet, so treating
 * "provider list identical to a snapshot we just invented" as N new
 * additions would be noise, not signal.
 */
export async function runProviderSnapshot(): Promise<{ scanned: number; additions: number }> {
  const [watchlisted, owned] = await Promise.all([
    prisma.watchlistItem.findMany({ select: { movieId: true }, distinct: ["movieId"] }),
    prisma.ownedItem.findMany({ select: { movieId: true }, distinct: ["movieId"] }),
  ]);
  const movieIds = [...new Set([...watchlisted, ...owned].map((r) => r.movieId))];
  if (movieIds.length === 0) return { scanned: 0, additions: 0 };

  const movies = await prisma.movie.findMany({
    where: { id: { in: movieIds } },
    select: { id: true, tmdbId: true },
  });

  const existingSnapshots = await prisma.movieProviderSnapshot.findMany({
    where: { movieId: { in: movieIds } },
  });
  const snapshotByMovieId = new Map(existingSnapshots.map((s) => [s.movieId, s]));

  let additions = 0;

  for (let i = 0; i < movies.length; i += SNAPSHOT_CONCURRENCY) {
    const batch = movies.slice(i, i + SNAPSHOT_CONCURRENCY);
    await Promise.all(
      batch.map(async (movie) => {
        const providers = await getFlatrateProviders(movie.tmdbId);
        const currentIds = providers.map((p) => p.provider_id);
        const previous = snapshotByMovieId.get(movie.id);

        if (previous) {
          const previousIds = parseProviderIds(previous.providerIds);
          const newlyAdded = providers.filter((p) => !previousIds.has(p.provider_id));
          if (newlyAdded.length > 0) {
            await prisma.providerAddition.createMany({
              data: newlyAdded.map((p) => ({
                movieId: movie.id,
                providerId: p.provider_id,
                providerName: p.provider_name,
              })),
            });
            additions += newlyAdded.length;
          }
        }

        await prisma.movieProviderSnapshot.upsert({
          where: { movieId: movie.id },
          update: { providerIds: currentIds.join(",") },
          create: { movieId: movie.id, providerIds: currentIds.join(",") },
        });
      })
    );
  }

  return { scanned: movies.length, additions };
}

export type RecentlyAddedMovie = {
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  providerName: string;
  detectedAt: Date;
};

/**
 * Movies on the user's watchlist that picked up one of their configured
 * services within the recent window — the homepage "Recently added to your
 * services" row. Scoped to the watchlist (not all of TMDB) for the same
 * reason the existing "Rent or Buy" row is: these are movies the user
 * already said they want to watch, not a firehose of every addition across
 * every service.
 */
export async function getRecentlyAddedForUser(
  userId: string,
  userProviderIds: Set<number>
): Promise<RecentlyAddedMovie[]> {
  if (userProviderIds.size === 0) return [];

  const since = new Date(Date.now() - RECENTLY_ADDED_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const additions = await prisma.providerAddition.findMany({
    where: {
      providerId: { in: [...userProviderIds] },
      detectedAt: { gte: since },
      movie: { watchlist: { some: { userId } } },
    },
    orderBy: { detectedAt: "desc" },
    include: { movie: true },
  });

  const seen = new Set<string>();
  const results: RecentlyAddedMovie[] = [];
  for (const addition of additions) {
    if (seen.has(addition.movieId)) continue;
    seen.add(addition.movieId);
    results.push({
      tmdbId: addition.movie.tmdbId,
      title: addition.movie.title,
      overview: addition.movie.overview,
      posterPath: addition.movie.posterPath,
      backdropPath: addition.movie.backdropPath,
      releaseDate: addition.movie.releaseDate,
      voteAverage: addition.movie.voteAverage,
      providerName: addition.providerName,
      detectedAt: addition.detectedAt,
    });
  }
  return results;
}
