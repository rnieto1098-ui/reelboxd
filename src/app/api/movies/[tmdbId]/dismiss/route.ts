import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movieForRoute, parseTmdbId } from "@/lib/movieRoute";

// "Not for me" on Discover. The film is hidden from Discover for good, and
// its genres count against it when other films are scored there. DELETE
// is the undo.
export async function POST(_request: Request, context: { params: Promise<{ tmdbId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { tmdbId } = await context.params;
  const cached = await movieForRoute(tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;

  await prisma.dismissedMovie.upsert({
    where: { userId_movieId: { userId, movieId: movie.id } },
    update: {},
    create: { userId, movieId: movie.id },
  });
  return NextResponse.json({ ok: true, dismissed: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ tmdbId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { tmdbId } = await context.params;
  const id = parseTmdbId(tmdbId);
  if (id == null) return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });

  await prisma.dismissedMovie.deleteMany({
    where: { userId: session.user.id, movie: { tmdbId: id } },
  });
  return NextResponse.json({ ok: true, dismissed: false });
}
