import { prisma } from "@/lib/prisma";
import { discoverMovies } from "@/lib/tmdb";
import { WATCH_REGION, getFlatrateProviderIdsByTmdbId } from "@/lib/streaming";
import { MIN_RECOMMENDABLE_RUNTIME_MINUTES } from "@/lib/runtimeFilter";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { getDiscoverFeed } from "@/lib/discover/feed";
import { cleanMovieList } from "@/lib/movieListHygiene";

// What the Couch TV shows: one "app" per streaming service, each with rows
// of films on that service. The personal rows come straight from Discover's
// feed (same scoring, same cache), split by service; a "Popular on …" row
// makes sure every app has something in it even before you've rated much.
// Each app opens on your own watchlist films that are streaming there,
// read fresh on every visit rather than from the cached feed.

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
  // Services straight from the account, not from the (cached) feed, so
  // every service the user has added gets an app tile, in the order they
  // added them.
  const [feed, watched, accountServices, watchlistItems] = await Promise.all([
    getDiscoverFeed(userId, null, null),
    getWatchedTmdbIds(userId),
    prisma.streamingService.findMany({
      where: { userId },
      select: { providerId: true, providerName: true, logoPath: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { addedAt: "desc" },
      select: {
        movie: {
          select: { id: true, tmdbId: true, title: true, posterPath: true, backdropPath: true, releaseDate: true },
        },
      },
    }),
  ]);
  // Where each watchlist film streams: the daily provider snapshot, with a
  // live lookup (cached a day) for films that don't have one yet.
  const watchlistProviders = await getFlatrateProviderIdsByTmdbId(
    watchlistItems.map((w) => ({ id: w.movie.id, tmdbId: w.movie.tmdbId }))
  );
  const allServices = accountServices.map((s) => ({ id: s.providerId, name: s.providerName, logoPath: s.logoPath }));

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
    allServices.map((s) =>
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

  const accountProviderIds = new Set(allServices.map((s) => s.id));
  for (const { movie } of watchlistItems) {
    const on = [...(watchlistProviders.get(movie.tmdbId) ?? [])].filter((id) => accountProviderIds.has(id));
    if (on.length === 0) continue;
    films[movie.tmdbId] = {
      id: movie.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      year: movie.releaseDate ? movie.releaseDate.slice(0, 4) : null,
      providerIds: on,
    };
  }

  const services: CouchService[] = allServices.map((s, i) => {
    // Newest additions first, every one of them: this row is the point of
    // opening an app, so no minimum and no cap.
    const watchlistIds = watchlistItems
      .map((w) => w.movie.tmdbId)
      .filter((id) => films[id]?.providerIds.includes(s.id));

    const rows = feed.rows
      // The feed's own watchlist row is replaced by the fresh one above.
      .filter((row) => row.key !== "watchlist")
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
    if (watchlistIds.length > 0) {
      // Shown once, up top, rather than again further down the same app.
      const onWatchlist = new Set(watchlistIds);
      for (const row of rows) row.ids = row.ids.filter((id) => !onWatchlist.has(id));
      rows.splice(0, rows.length, ...rows.filter((row) => row.ids.length >= MIN_ROW));
      rows.unshift({ title: "On your watchlist", ids: watchlistIds });
    }

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
