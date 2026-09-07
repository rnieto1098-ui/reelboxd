import { prisma } from "@/lib/prisma";

// Chunked rather than one transaction: a curated list can run to hundreds of
// films, and this is the same shape the add-to-watchlist route already used.
const WRITE_CONCURRENCY = 12;

/**
 * Which of these films the user has already seen, keyed by local Movie id.
 *
 * The same three signals getWatchedTmdbIds unions — a rating, a diary entry,
 * or an undated watched mark — just keyed by movieId instead of tmdbId,
 * since that's what watchlist rows are written against. Keep the two in step
 * if a fourth way to record a watch ever shows up.
 */
export async function getWatchedMovieIds(
  userId: string,
  movieIds: string[]
): Promise<Set<string>> {
  if (movieIds.length === 0) return new Set();

  const where = { userId, movieId: { in: movieIds } };
  const [ratings, diaryEntries, marks] = await Promise.all([
    prisma.rating.findMany({ where, select: { movieId: true } }),
    prisma.diaryEntry.findMany({ where, select: { movieId: true }, distinct: ["movieId"] }),
    prisma.watchedItem.findMany({ where, select: { movieId: true } }),
  ]);

  return new Set([...ratings, ...diaryEntries, ...marks].map((r) => r.movieId));
}

/**
 * The only way anything in this app puts a film on a watchlist.
 *
 * A watchlist is a list of films you still intend to see, so a film you've
 * already seen has no business on it. The app enforced half of that already
 * — rating, logging, or marking a film watched all drop it from the
 * watchlist — but nothing stopped it going back on afterwards, and the five
 * different places that added to a watchlist each would have needed the same
 * check. Routing all of them through here keeps that from drifting apart
 * again: skipping the watched ones isn't something a caller can forget.
 *
 * Returns what actually happened so callers can say so — silently dropping
 * films from a bulk add would look like a bug from the outside.
 */
export async function addToWatchlist(
  userId: string,
  movieIds: string[]
): Promise<{ added: number; skippedWatched: number }> {
  const unique = [...new Set(movieIds)];
  if (unique.length === 0) return { added: 0, skippedWatched: 0 };

  const watched = await getWatchedMovieIds(userId, unique);
  const addable = unique.filter((id) => !watched.has(id));

  for (let i = 0; i < addable.length; i += WRITE_CONCURRENCY) {
    const chunk = addable.slice(i, i + WRITE_CONCURRENCY);
    await Promise.all(
      chunk.map((movieId) =>
        prisma.watchlistItem.upsert({
          where: { userId_movieId: { userId, movieId } },
          update: {},
          create: { userId, movieId },
        })
      )
    );
  }

  return { added: addable.length, skippedWatched: unique.length - addable.length };
}
