import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CHART_DAYS = 30;

/**
 * Counts per UTC day for the last `days` days, oldest first, with zero-count
 * days included so a chart of them has no gaps. Pure, for testing.
 */
export function bucketByDay(
  dates: Date[],
  days: number,
  now: Date = new Date()
): { day: string; count: number }[] {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    counts.set(new Date(todayStart - i * DAY_MS).toISOString().slice(0, 10), 0);
  }
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return [...counts.entries()].map(([day, count]) => ({ day, count }));
}

/** Everything the admin overview shows, gathered in one round of queries. */
export async function getAdminOverview() {
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - CHART_DAYS * DAY_MS);

  const [
    users,
    usersWeek,
    diary,
    diaryWeek,
    ratings,
    userLists,
    challenges,
    watchlistItems,
    moviesCached,
    letterboxdConnected,
    recentSignups,
    recentLogs,
    newestUsers,
    activeGroups,
    filmGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.diaryEntry.count(),
    prisma.diaryEntry.count({ where: { createdAt: { gte: since7 } } }),
    prisma.rating.count(),
    prisma.list.count({ where: { isSystem: false } }),
    prisma.challenge.count(),
    prisma.watchlistItem.count(),
    prisma.movie.count(),
    prisma.user.count({ where: { letterboxdUsername: { not: null } } }),
    prisma.user.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
    prisma.diaryEntry.findMany({
      where: { createdAt: { gte: since30 } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, username: true, image: true, createdAt: true },
    }),
    prisma.diaryEntry.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 6,
    }),
    prisma.diaryEntry.groupBy({
      by: ["movieId"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { movieId: "desc" } },
      take: 6,
    }),
  ]);

  const [activeUsers, topMovies] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: activeGroups.map((g) => g.userId) } },
      select: { id: true, username: true },
    }),
    prisma.movie.findMany({
      where: { id: { in: filmGroups.map((g) => g.movieId) } },
      select: { id: true, tmdbId: true, title: true },
    }),
  ]);
  const usernameById = new Map(activeUsers.map((u) => [u.id, u.username]));
  const movieById = new Map(topMovies.map((m) => [m.id, m]));

  return {
    totals: {
      users,
      usersWeek,
      diary,
      diaryWeek,
      ratings,
      userLists,
      challenges,
      watchlistItems,
      moviesCached,
      letterboxdConnected,
    },
    signupsByDay: bucketByDay(
      recentSignups.map((u) => u.createdAt),
      CHART_DAYS,
      now
    ),
    logsByDay: bucketByDay(
      recentLogs.map((d) => d.createdAt),
      CHART_DAYS,
      now
    ),
    newestUsers,
    mostActive: activeGroups
      .map((g) => ({ username: usernameById.get(g.userId), count: g._count._all }))
      .filter((u): u is { username: string; count: number } => !!u.username),
    topFilms: filmGroups
      .map((g) => ({ movie: movieById.get(g.movieId), count: g._count._all }))
      .filter((f): f is { movie: { id: string; tmdbId: number; title: string }; count: number } =>
        Boolean(f.movie)
      ),
  };
}
