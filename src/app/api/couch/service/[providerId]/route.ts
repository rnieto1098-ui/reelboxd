import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { discoverMovies } from "@/lib/tmdb";
import { WATCH_REGION } from "@/lib/streaming";
import { MIN_RECOMMENDABLE_RUNTIME_MINUTES } from "@/lib/runtimeFilter";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { getDiscoverFeed } from "@/lib/discover/feed";
import { cleanMovieList } from "@/lib/movieListHygiene";
import { serviceCategories } from "@/lib/couch/categories";
import type { CouchFilm } from "@/lib/couch/data";

// The browse rows for one Couch app (new, acclaimed, hidden gems, genres
// ...), fetched when the app is opened rather than for every app up front.

const MIN_ROW = 3;
const ROW_LENGTH = 20;
// These lists barely move day to day.
const REVALIDATE_SECONDS = 6 * 60 * 60;

export async function GET(_request: Request, context: { params: Promise<{ providerId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const providerId = Number((await context.params).providerId);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return NextResponse.json({ error: "Invalid service" }, { status: 400 });
  }
  const service = await prisma.streamingService.findFirst({
    where: { userId, providerId },
    select: { providerName: true },
  });
  if (!service) return NextResponse.json({ error: "Not one of your services" }, { status: 404 });

  // The feed is cached, so this is only its taste profile, not a rebuild.
  const [feed, watched] = await Promise.all([getDiscoverFeed(userId, null, null), getWatchedTmdbIds(userId)]);
  const categories = serviceCategories(service.providerName, feed.topGenres);

  const results = await Promise.all(
    categories.map((c) =>
      discoverMovies({
        ...c.query,
        watchProviderIds: [providerId],
        watchRegion: WATCH_REGION,
        minRuntime: MIN_RECOMMENDABLE_RUNTIME_MINUTES,
        revalidateSeconds: REVALIDATE_SECONDS,
      })
        .then((r) => cleanMovieList(r.results))
        .catch(() => [])
    )
  );

  const films: Record<number, CouchFilm> = {};
  const rows: { title: string; ids: number[] }[] = [];
  categories.forEach((c, i) => {
    const ids: number[] = [];
    for (const m of results[i]) {
      if (watched.has(m.id) || ids.length >= ROW_LENGTH) continue;
      films[m.id] ??= {
        id: m.id,
        title: m.title,
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        year: m.release_date ? m.release_date.slice(0, 4) : null,
        providerIds: [providerId],
      };
      ids.push(m.id);
    }
    if (ids.length >= MIN_ROW) rows.push({ title: c.title, ids });
  });

  return NextResponse.json({ rows, films }, { headers: { "Cache-Control": "private, max-age=600" } });
}
