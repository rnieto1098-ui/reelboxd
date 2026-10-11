import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";

// Unlike the watchlist route, there's no "already watched" check here — a
// film you've seen is exactly what belongs on a rewatch list.
export async function POST(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { tmdbId } = await context.params;
  const movie = await ensureMovieCached(Number(tmdbId));

  await prisma.rewatchItem.upsert({
    where: { userId_movieId: { userId, movieId: movie.id } },
    update: {},
    create: { userId, movieId: movie.id },
  });

  return NextResponse.json({ ok: true, inRewatch: true });
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
  if (movie) {
    await prisma.rewatchItem.deleteMany({
      where: { userId: session.user.id, movieId: movie.id },
    });
  }

  return NextResponse.json({ ok: true, inRewatch: false });
}
