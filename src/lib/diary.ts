import { prisma } from "@/lib/prisma";

/**
 * Logs one watch of a movie. `rewatch` is auto-detected (true if this user
 * already has any prior diary entry for this movie) when not given
 * explicitly — mirrors how logging actually works: the first log of a film
 * is a watch, every one after that is a rewatch, unless the caller knows
 * better (e.g. backfilling an explicit "first watch" date after already
 * having logged a rewatch more recently).
 *
 * Also drops the movie from the watchlist, same as rating one does — once
 * it's logged as watched it doesn't belong on a "want to watch" list
 * anymore. A no-op if it was never there.
 */
export async function createDiaryEntry({
  userId,
  movieId,
  watchedDate,
  rewatch,
}: {
  userId: string;
  movieId: string;
  watchedDate?: Date;
  rewatch?: boolean;
}) {
  const isRewatch =
    rewatch ??
    (await prisma.diaryEntry.findFirst({
      where: { userId, movieId },
      select: { id: true },
    })) != null;

  const [entry] = await Promise.all([
    prisma.diaryEntry.create({
      data: {
        userId,
        movieId,
        watchedDate: watchedDate ?? new Date(),
        rewatch: isRewatch,
      },
    }),
    prisma.watchlistItem.deleteMany({ where: { userId, movieId } }),
  ]);

  return entry;
}
