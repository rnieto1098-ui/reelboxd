import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movieForRoute } from "@/lib/movieRoute";

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
  const body = await request.json().catch(() => null);
  const parsed = posterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid poster" },
      { status: 400 }
    );
  }

  const cached = await movieForRoute(tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;

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
