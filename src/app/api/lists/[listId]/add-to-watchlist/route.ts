import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";

// Cache-first (ensureMovieCached hits the local DB before ever touching
// TMDB), so this can run at higher concurrency than a per-item TMDB call
// like the watchlist page's provider lookups — same reasoning as the crew
// person page's runtime lookup.
const CONCURRENCY = 12;

async function mapInChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    results.push(...(await Promise.all(chunk.map(fn))));
  }
  return results;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { id: true, items: { select: { tmdbId: true } } },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (list.items.length === 0) return NextResponse.json({ added: 0, total: 0 });

  const existing = await prisma.watchlistItem.findMany({
    where: { userId, movie: { tmdbId: { in: list.items.map((i) => i.tmdbId) } } },
    select: { movie: { select: { tmdbId: true } } },
  });
  const alreadyWatchlisted = new Set(existing.map((e) => e.movie.tmdbId));
  const toAdd = list.items.filter((i) => !alreadyWatchlisted.has(i.tmdbId));

  const movies = await mapInChunks(toAdd, CONCURRENCY, (item) =>
    ensureMovieCached(item.tmdbId).catch(() => null)
  );

  await mapInChunks(
    movies.filter((m) => m != null),
    CONCURRENCY,
    (movie) =>
      prisma.watchlistItem.upsert({
        where: { userId_movieId: { userId, movieId: movie.id } },
        update: {},
        create: { userId, movieId: movie.id },
      })
  );

  return NextResponse.json({ added: movies.filter((m) => m != null).length, total: list.items.length });
}
