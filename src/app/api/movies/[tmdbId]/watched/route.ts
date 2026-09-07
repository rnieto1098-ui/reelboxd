import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";
import { checkNewlyCompletedChallenges } from "@/lib/challenges";

export async function POST(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const movie = await ensureMovieCached(Number(tmdbId));
  const userId = session.user.id;

  const existing = await prisma.watchedItem.findUnique({
    where: { userId_movieId: { userId, movieId: movie.id } },
  });

  await prisma.$transaction([
    prisma.watchedItem.upsert({
      where: { userId_movieId: { userId, movieId: movie.id } },
      update: {},
      create: { userId, movieId: movie.id },
    }),
    // Same as logging or rating a film: once you've said you've seen it, it
    // doesn't belong on a "want to watch" list. A no-op if it wasn't there.
    prisma.watchlistItem.deleteMany({ where: { userId, movieId: movie.id } }),
  ]);

  // Only on a mark that actually changed something — re-marking an already
  // watched film shouldn't re-fire a completion toast. Null date because
  // this mark has none, which skips date-range challenges (see that
  // function); watch goals are year-scoped and so aren't checked at all.
  const completedChallenges = existing
    ? []
    : await checkNewlyCompletedChallenges(userId, movie, null);

  return NextResponse.json({ ok: true, watched: true, completedChallenges });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const userId = session.user.id;
  const movie = await prisma.movie.findUnique({ where: { tmdbId: Number(tmdbId) } });
  if (!movie) return NextResponse.json({ ok: true, watched: false });

  await prisma.watchedItem
    .delete({ where: { userId_movieId: { userId, movieId: movie.id } } })
    .catch(() => null);

  // Dropping the mark doesn't necessarily make a film unwatched — a diary
  // entry or a rating says you've seen it just as much. Report what's
  // actually true now so the button can't end up claiming otherwise, and
  // so it can explain why an un-mark appeared to do nothing.
  const [loggedCount, ratingCount] = await Promise.all([
    prisma.diaryEntry.count({ where: { userId, movieId: movie.id } }),
    prisma.rating.count({ where: { userId, movieId: movie.id } }),
  ]);
  const stillWatched = loggedCount > 0 || ratingCount > 0;

  return NextResponse.json({
    ok: true,
    watched: stillWatched,
    stillWatchedBecause: loggedCount > 0 ? "diary" : ratingCount > 0 ? "rating" : null,
  });
}
