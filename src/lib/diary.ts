import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DiaryEntry } from "@prisma/client";

// A movie can only be logged once per calendar day — a second log attempt
// for the same movie on the same day is treated as if it never happened
// (the existing entry is returned as-is, nothing new is created). Compared
// in UTC to match how watchedDate is stored everywhere a date-only value
// comes in (Letterboxd sync/import both write `T00:00:00.000Z`).
function dayRangeUTC(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

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
 *
 * Returns `created: false` (with the pre-existing entry) if this movie was
 * already logged today — callers should treat that as nothing having
 * happened: no watchlist removal, no challenge/goal re-checks, no second
 * "logged!" toast.
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
}): Promise<{ entry: DiaryEntry; created: boolean }> {
  const effectiveDate = watchedDate ?? new Date();
  const { start, end } = dayRangeUTC(effectiveDate);

  const existingToday = await prisma.diaryEntry.findFirst({
    where: { userId, movieId, watchedDate: { gte: start, lt: end } },
  });
  if (existingToday) {
    return { entry: existingToday, created: false };
  }

  const isRewatch =
    rewatch ??
    (await prisma.diaryEntry.findFirst({
      where: { userId, movieId },
      select: { id: true },
    })) != null;

  // The findFirst check above is a fast path, not the real guarantee — two
  // requests can both pass it before either write lands (double-click, or a
  // manual log racing the sync cron). The @@unique([userId, movieId,
  // watchedDay]) constraint is the actual source of truth: if this create
  // loses that race, it throws P2002, and we treat it exactly like the fast
  // path above — return the entry that won, created: false.
  try {
    const [entry] = await Promise.all([
      prisma.diaryEntry.create({
        data: {
          userId,
          movieId,
          watchedDate: effectiveDate,
          watchedDay: start,
          rewatch: isRewatch,
        },
      }),
      prisma.watchlistItem.deleteMany({ where: { userId, movieId } }),
    ]);

    return { entry, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.diaryEntry.findFirst({
        where: { userId, movieId, watchedDay: start },
      });
      if (winner) return { entry: winner, created: false };
    }
    throw error;
  }
}
