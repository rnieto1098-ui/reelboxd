import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movieForRoute } from "@/lib/movieRoute";
import { revalidateListCache } from "@/lib/listCache";

// Only the film's id is trusted from the request. Title, poster and release
// date used to be taken from it too and stored as sent, on lists other
// people can see, so a hand-made request could file any text under any film.
// They are read from the cached TMDB record instead; older clients that
// still send them are simply ignored.
const addItemSchema = z.object({
  tmdbId: z.number().int().positive(),
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
  const list = await prisma.list.findUnique({ where: { id: listId } });

  if (!list || list.isSystem || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid movie" },
      { status: 400 }
    );
  }

  // Cached so the list's "Popularity" sort has real data for this item —
  // same movie-caching step every other write route in the app already does.
  const cached = await movieForRoute(parsed.data.tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;

  // One past the highest position in use. This was the item *count*, which
  // collides after a removal: delete the first of three films, add one, and
  // two items shared position 2 and their order became arbitrary.
  const last = await prisma.listItem.aggregate({ where: { listId }, _max: { position: true } });
  const nextPosition = (last._max.position ?? -1) + 1;

  const item = await prisma.listItem.upsert({
    where: { listId_tmdbId: { listId, tmdbId: parsed.data.tmdbId } },
    update: {},
    create: {
      listId,
      tmdbId: parsed.data.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      releaseDate: movie.releaseDate,
      popularity: movie.popularity,
      position: nextPosition,
    },
  });
  revalidateListCache();

  return NextResponse.json(item, { status: 201 });
}
