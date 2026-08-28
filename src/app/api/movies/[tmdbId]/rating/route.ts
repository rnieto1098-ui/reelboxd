import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";
import { createDiaryEntry } from "@/lib/diary";

const ratingSchema = z.object({
  score: z.number().min(0.5).max(5).multipleOf(0.5),
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
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rating" },
      { status: 400 }
    );
  }

  const movie = await ensureMovieCached(Number(tmdbId));

  // Only the *first* rating of a movie implies a fresh watch worth logging —
  // re-rating (adjusting your opinion) shouldn't spam another diary entry.
  const existingRating = await prisma.rating.findUnique({
    where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    select: { id: true },
  });

  const [rating] = await Promise.all([
    prisma.rating.upsert({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
      update: { score: parsed.data.score },
      create: { userId: session.user.id, movieId: movie.id, score: parsed.data.score },
    }),
    // Rating a movie means it's watched — it doesn't belong on the
    // watchlist anymore. A no-op if it was never there.
    prisma.watchlistItem.deleteMany({
      where: { userId: session.user.id, movieId: movie.id },
    }),
    existingRating
      ? Promise.resolve(null)
      : createDiaryEntry({ userId: session.user.id, movieId: movie.id }),
  ]);

  return NextResponse.json(rating);
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

  await prisma.rating
    .delete({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
