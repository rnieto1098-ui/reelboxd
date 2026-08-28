import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";

const addItemSchema = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().min(1),
  posterPath: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { _count: { select: { items: true } } },
  });

  if (!list || list.isSystem || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid movie" }, { status: 400 });
  }

  // Cached so the list's "Popularity" sort has real data for this item —
  // same movie-caching step every other write route in the app already does.
  const movie = await ensureMovieCached(parsed.data.tmdbId);

  const item = await prisma.listItem.upsert({
    where: { listId_tmdbId: { listId, tmdbId: parsed.data.tmdbId } },
    update: {},
    create: {
      listId,
      tmdbId: parsed.data.tmdbId,
      title: parsed.data.title,
      posterPath: parsed.data.posterPath ?? null,
      releaseDate: parsed.data.releaseDate ?? null,
      popularity: movie.popularity,
      position: list._count.items,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
