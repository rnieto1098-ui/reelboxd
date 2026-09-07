import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";
import { addToWatchlist } from "@/lib/watchlist";

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

  const { added } = await addToWatchlist(session.user.id, [movie.id]);

  // Not an error — asking to watchlist something you've already seen is a
  // reasonable thing to click, it just doesn't do anything. Reported rather
  // than swallowed so the button can revert its optimistic flip and say why
  // instead of claiming the film is on a list it isn't on.
  return NextResponse.json({
    ok: true,
    inWatchlist: added > 0,
    blockedByWatched: added === 0,
  });
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
  const movie = await prisma.movie.findUnique({ where: { tmdbId: Number(tmdbId) } });
  if (!movie) return NextResponse.json({ ok: true, inWatchlist: false });

  await prisma.watchlistItem
    .delete({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true, inWatchlist: false });
}
