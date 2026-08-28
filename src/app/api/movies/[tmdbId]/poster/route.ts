import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";

const posterSchema = z.object({
  posterPath: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const body = await request.json();
  const parsed = posterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid poster" }, { status: 400 });
  }

  const movie = await ensureMovieCached(Number(tmdbId));

  const customPoster = await prisma.customPoster.upsert({
    where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    update: { posterPath: parsed.data.posterPath },
    create: {
      userId: session.user.id,
      movieId: movie.id,
      posterPath: parsed.data.posterPath,
    },
  });

  return NextResponse.json(customPoster);
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
  if (!movie) return NextResponse.json({ ok: true });

  await prisma.customPoster
    .delete({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
