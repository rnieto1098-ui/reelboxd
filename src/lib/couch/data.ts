import { prisma } from "@/lib/prisma";
import { discoverMovies } from "@/lib/tmdb";
import { WATCH_REGION } from "@/lib/streaming";
import { MIN_RECOMMENDABLE_RUNTIME_MINUTES } from "@/lib/runtimeFilter";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { getDiscoverFeed } from "@/lib/discover/feed";
import { cleanMovieList } from "@/lib/movieListHygiene";

// What the Couch TV shows: one "app" per streaming service, each with rows
// of films on that service. The personal rows come straight from Discover's
// feed (same scoring, same cache), split by service; a "Popular on …" row
// makes sure every app has something in it even before you've rated much.

export type CouchFilm = {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
  providerIds: number[];
};

export type CouchService = {
  id: number;
  name: string;
  logoPath: string | null;
  rows: { title: string; ids: number[] }[];
};

export type CouchData = {
  services: CouchService[];
  films: Record<number, CouchFilm>;
  // Best matches across every service, for the home screen.
  picks: number[];
  watchlistIds: number[];
};

const MIN_ROW = 3;

export async function getCouchData(userId: string): Promise<CouchData> {
  const [feed, watched] = await Promise.all([
    getDiscoverFeed(userId, null, null),
    getWatchedTmdbIds(userId),
  ]);

  const films: Record<number, CouchFilm> = {};
  for (const row of feed.rows) {
    for (const f of row.films) {
      films[f.id] ??= {
        id: f.id,
        title: f.title,
        posterPath: f.posterPath,
        backdropPath: f.backdropPath,
        year: f.year,
        providerIds: f.providerIds,
      };
    }
  }

  const popular = await Promise.all(
    feed.services.map((s) =>
      discoverMovies({
        watchProviderIds: [s.id],
        watchRegion: WATCH_REGION,
        sortBy: "popularity.desc",
        minVoteCount: 300,
        minRuntime: MIN_RECOMMENDABLE_RUNTIME_MINUTES,
      })
        .then((r) => cleanMovieList(r.results).filter((m) => !watched.has(m.id)))
        .catch(() => [])
    )
  );

  const services: CouchService[] = feed.services.map((s, i) => {
    const rows = feed.rows
      .map((row) => ({
        title: row.title,
        ids: row.films.filter((f) => f.providerIds.includes(s.id)).map((f) => f.id),
      }))
      .filter((row) => row.ids.length >= MIN_ROW);

    const popularIds: number[] = [];
    for (const m of popular[i]) {
      films[m.id] ??= {
        id: m.id,
        title: m.title,
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        year: m.release_date ? m.release_date.slice(0, 4) : null,
        providerIds: [s.id],
      };
      if (!films[m.id].providerIds.includes(s.id)) films[m.id].providerIds.push(s.id);
      popularIds.push(m.id);
    }
    if (popularIds.length >= MIN_ROW) rows.push({ title: `Popular on ${s.name}`, ids: popularIds.slice(0, 20) });

    return { id: s.id, name: s.name, logoPath: s.logoPath, rows };
  });

  const top = feed.rows.find((r) => r.key === "top") ?? feed.rows[0];
  return {
    services,
    films,
    picks: (top?.films ?? []).slice(0, 12).map((f) => f.id),
    watchlistIds: feed.watchlistIds,
  };
}

export async function hasStreamingServices(userId: string): Promise<boolean> {
  return (await prisma.streamingService.count({ where: { userId } })) > 0;
}
