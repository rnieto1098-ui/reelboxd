import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movieForRoute } from "@/lib/movieRoute";

export async function POST(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const cached = await movieForRoute(tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;

  await prisma.like.upsert({
    where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    update: {},
    create: { userId: session.user.id, movieId: movie.id },
  });

  return NextResponse.json({ ok: true, liked: true });
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
  if (!movie) return NextResponse.json({ ok: true, liked: false });

  await prisma.like
    .delete({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true, liked: false });
}
