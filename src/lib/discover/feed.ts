import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  discoverMoviesMultiPage,
  getSimilarMovies,
  type TmdbMovieSummary,
} from "@/lib/tmdb";
import { WATCH_REGION, getFlatrateProviders } from "@/lib/streaming";
import { getRuntimesById, MIN_RECOMMENDABLE_RUNTIME_MINUTES } from "@/lib/runtimeFilter";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { cleanMovieList } from "@/lib/movieListHygiene";
import {
  GENRE_NAMES,
  buildTasteProfile,
  differentGenres,
  fitsGenres,
  genreIdsFromNames,
  reasonGenre,
  scoreFilm,
  type Mood,
  type RuntimeLimit,
  type TasteProfile,
  type TasteSignal,
} from "@/lib/discover/taste";

// The Discover page: rows of films streaming on the user's own services,
// each with a reason, scored against what they rate, log and dismiss.
// lib/discover/taste.ts holds the scoring; this file fetches and assembles.

export type DiscoverFilm = {
  id: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
  voteAverage: number;
  // Which of the user's services it's on (never empty for a shown film).
  providerIds: number[];
  score: number;
  reason: string | null;
};

export type DiscoverRowData = {
  key: string;
  title: string;
  subtitle?: string;
  films: DiscoverFilm[];
};

export type DiscoverService = { id: number; name: string; logoPath: string | null };

export type DiscoverFeed = {
  rows: DiscoverRowData[];
  services: DiscoverService[];
  signalCount: number;
  topGenres: string[];
  // Fresh per request (not cached): the cards' initial watchlist state.
  watchlistIds: number[];
};

// Kept lean: every field here is sent to the browser for every card. The
// spotlight fetches the plot summary and the rest when it opens.
const ROW_SIZE = 16;
const ROW_MIN = 4;
// Rows are filled past ROW_SIZE before availability is double-checked, so a
// few films dropping out still leaves a full row.
const ROW_OVERFILL = 6;
const SOURCE_CAP = 40;
const FEED_CACHE_SECONDS = 3 * 60 * 60;

type Candidate = TmdbMovieSummary & { genre_ids: number[] };

function isoDay(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** A cached Movie row in the shape TMDB list endpoints return. */
function summaryFromMovie(movie: {
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  popularity: number | null;
  genres: string | null;
}): Candidate {
  return {
    id: movie.tmdbId,
    title: movie.title,
    overview: movie.overview ?? "",
    poster_path: movie.posterPath,
    backdrop_path: movie.backdropPath,
    release_date: movie.releaseDate ?? "",
    vote_average: movie.voteAverage ?? 0,
    // Cached rows carry no vote count; treat them as well established so the
    // score doesn't discount them as "few votes".
    vote_count: 1000,
    popularity: movie.popularity ?? 0,
    genre_ids: genreIdsFromNames(movie.genres),
  };
}

const MOVIE_FIELDS = {
  tmdbId: true,
  title: true,
  overview: true,
  posterPath: true,
  backdropPath: true,
  releaseDate: true,
  voteAverage: true,
  popularity: true,
  genres: true,
  runtime: true,
  directorId: true,
  directorName: true,
  topCastIds: true,
  topCastNames: true,
} as const;

function splitIds(value: string | null): number[] {
  return (value ?? "")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Everything the user has said about films, merged one signal per film. */
async function loadSignals(userId: string): Promise<TasteSignal[]> {
  const select = { movie: { select: MOVIE_FIELDS } } as const;
  const [ratings, diary, watched, dismissed] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, select: { ...select, score: true, updatedAt: true } }),
    prisma.diaryEntry.findMany({
      where: { userId },
      select: { ...select, watchedDate: true },
      orderBy: { watchedDate: "desc" },
    }),
    prisma.watchedItem.findMany({ where: { userId }, select: { ...select, addedAt: true } }),
    prisma.dismissedMovie.findMany({ where: { userId }, select: { ...select, createdAt: true } }),
  ]);

  const byFilm = new Map<number, TasteSignal>();
  const toSignal = (
    movie: (typeof ratings)[number]["movie"],
    score: number | null,
    at: Date,
    isDismissed = false
  ): TasteSignal => ({
    tmdbId: movie.tmdbId,
    title: movie.title,
    genreIds: genreIdsFromNames(movie.genres),
    directorId: movie.directorId,
    directorName: movie.directorName,
    castIds: splitIds(movie.topCastIds),
    castNames: (movie.topCastNames ?? "").split(",").map((n) => n.trim()),
    score,
    dismissed: isDismissed,
    at: at.getTime(),
  });

  // A rating says the most, so it goes in first and wins.
  for (const r of ratings) byFilm.set(r.movie.tmdbId, toSignal(r.movie, r.score, r.updatedAt));
  for (const d of diary) {
    if (!byFilm.has(d.movie.tmdbId)) byFilm.set(d.movie.tmdbId, toSignal(d.movie, null, d.watchedDate));
  }
  for (const w of watched) {
    if (!byFilm.has(w.movie.tmdbId)) byFilm.set(w.movie.tmdbId, toSignal(w.movie, null, w.addedAt));
  }
  for (const x of dismissed) {
    if (!byFilm.has(x.movie.tmdbId)) byFilm.set(x.movie.tmdbId, toSignal(x.movie, null, x.createdAt, true));
  }
  return [...byFilm.values()];
}

function withGenres(movies: TmdbMovieSummary[]): Candidate[] {
  return cleanMovieList(movies).map((m) => ({ ...m, genre_ids: m.genre_ids ?? [] }));
}

const settled = async <T,>(promise: Promise<T[]>): Promise<T[]> => promise.catch(() => []);

type Sources = {
  favourites: Candidate[];
  watchlist: Candidate[];
  forYou: Candidate[];
  fresh: Candidate[];
  seeds: { title: string; films: Candidate[] }[];
  people: Candidate[];
  gems: Candidate[];
  quick: Candidate[];
};

async function fetchSources(
  userId: string,
  providerIds: number[],
  profile: TasteProfile,
  mood: Mood | null,
  runtime: RuntimeLimit | null
): Promise<Sources> {
  const rules =
    mood?.id === "different"
      ? differentGenres(profile)
      : mood
        ? { include: mood.include, exclude: mood.exclude }
        : null;
  const genres = rules ? rules.include : profile.topGenres.slice(0, 3);
  const base = {
    watchProviderIds: providerIds,
    watchRegion: WATCH_REGION,
    minRuntime: MIN_RECOMMENDABLE_RUNTIME_MINUTES,
    maxRuntime: runtime ?? undefined,
    excludeGenreIds: rules && rules.exclude.length > 0 ? rules.exclude : undefined,
    anyGenreIds: genres.length > 0 ? genres : undefined,
  };

  const cutoff = new Date(Date.now() - 21 * 86_400_000);

  const [watchlistRows, additionRows, favouriteRows, forYou, topRated, recent, people, gems, quick, seedLists] =
    await Promise.all([
      prisma.watchlistItem.findMany({
        where: { userId },
        select: { movie: { select: { ...MOVIE_FIELDS, providerSnapshot: { select: { providerIds: true } } } } },
      }),
      prisma.providerAddition.findMany({
        where: { providerId: { in: providerIds }, detectedAt: { gte: cutoff } },
        orderBy: { detectedAt: "desc" },
        take: 200,
        select: { movie: { select: MOVIE_FIELDS } },
      }),
      mood?.id === "comfort"
        ? prisma.rating.findMany({
            where: { userId, score: { gte: 4 } },
            orderBy: { score: "desc" },
            take: 80,
            select: { movie: { select: MOVIE_FIELDS } },
          })
        : Promise.resolve([]),
      settled(
        discoverMoviesMultiPage({ ...base, sortBy: "popularity.desc", minVoteCount: 200 }, 3)
      ),
      settled(
        discoverMoviesMultiPage(
          { ...base, sortBy: "vote_average.desc", minVoteCount: 1500 },
          1
        )
      ),
      settled(
        discoverMoviesMultiPage(
          {
            ...base,
            // New releases aren't held to your top genres (a mood still
            // applies): what's new is worth seeing even outside your usual.
            anyGenreIds: rules && rules.include.length > 0 ? rules.include : undefined,
            sortBy: "popularity.desc",
            minVoteCount: 30,
            releasedAfter: isoDay(-365),
            releasedBefore: isoDay(),
          },
          2
        )
      ),
      profile.people.length > 0
        ? settled(
            discoverMoviesMultiPage(
              {
                ...base,
                anyGenreIds: rules && rules.include.length > 0 ? rules.include : undefined,
                anyPeopleIds: profile.people.map((p) => p.id),
                sortBy: "popularity.desc",
                minVoteCount: 50,
              },
              2
            )
          )
        : Promise.resolve([]),
      settled(
        discoverMoviesMultiPage(
          {
            ...base,
            sortBy: "vote_average.desc",
            minVoteAverage: 7.2,
            minVoteCount: 150,
            maxVoteCount: 2500,
          },
          2
        )
      ),
      runtime == null
        ? settled(
            discoverMoviesMultiPage(
              { ...base, minRuntime: 60, maxRuntime: 100, minVoteAverage: 6.5, minVoteCount: 200 },
              2
            )
          )
        : Promise.resolve([]),
      Promise.all(
        // "Comfort" and "Something different" are about leaving your
        // favourites' orbit or returning to them outright; neither wants
        // "Because you loved" rows.
        (mood?.id === "comfort" || mood?.id === "different" ? [] : profile.seeds).map(async (seed) => ({
          title: seed.title,
          films: await getSimilarMovies(seed.tmdbId)
            .then((r) => r.results)
            .catch(() => []),
        }))
      ),
    ]);

  const fitsMood = (c: Candidate) => !rules || fitsGenres(c.genre_ids, rules);

  // Sources that didn't come from a provider-filtered discover query: their
  // runtime and availability still need checking against the user's rules.
  const seedFilms = seedLists.map((s) => ({ title: s.title, films: withGenres(s.films).filter(fitsMood) }));
  const seedRuntimes = await getRuntimesById(seedFilms.flatMap((s) => s.films));
  const runtimeOk = (minutes: number | null | undefined) =>
    minutes != null &&
    minutes >= MIN_RECOMMENDABLE_RUNTIME_MINUTES &&
    (runtime == null || minutes <= runtime);

  const fromRows = (rows: { movie: (typeof additionRows)[number]["movie"] }[]) =>
    rows.filter((r) => runtimeOk(r.movie.runtime)).map((r) => summaryFromMovie(r.movie)).filter(fitsMood);

  const providerSet = new Set(providerIds);
  const watchlistOnServices = watchlistRows.filter((w) => {
    // The daily provider snapshot is the cheap check; films without one get
    // their live lookup in verifyAvailability like everything else.
    const snap = w.movie.providerSnapshot?.providerIds;
    return snap == null || splitIds(snap).some((id) => providerSet.has(id));
  });

  return {
    favourites: fromRows(favouriteRows),
    watchlist: fromRows(watchlistOnServices),
    forYou: withGenres([...forYou, ...topRated]),
    fresh: [...fromRows(additionRows), ...withGenres(recent)],
    seeds: seedFilms.map((s) => ({
      title: s.title,
      films: s.films.filter((f) => runtimeOk(seedRuntimes.get(f.id))),
    })),
    people: withGenres(people),
    gems: withGenres(gems),
    quick: withGenres(quick),
  };
}

function toFilm(c: Candidate, profile: TasteProfile, withReason: boolean): DiscoverFilm {
  return {
    id: c.id,
    title: c.title,
    posterPath: c.poster_path,
    backdropPath: c.backdrop_path,
    year: c.release_date ? c.release_date.slice(0, 4) : null,
    voteAverage: c.vote_average,
    providerIds: [],
    score: scoreFilm(c, profile),
    reason: withReason ? reasonGenre(c, profile) : null,
  };
}

async function buildFeed(
  userId: string,
  mood: Mood | null,
  runtime: RuntimeLimit | null
): Promise<Omit<DiscoverFeed, "watchlistIds">> {
  const services = await prisma.streamingService.findMany({
    where: { userId },
    select: { providerId: true, providerName: true, logoPath: true },
    orderBy: { createdAt: "asc" },
  });
  const serviceList = services.map((s) => ({ id: s.providerId, name: s.providerName, logoPath: s.logoPath }));
  if (services.length === 0) return { rows: [], services: [], signalCount: 0, topGenres: [] };

  const providerIds = services.map((s) => s.providerId);
  const signals = await loadSignals(userId);
  const profile = buildTasteProfile(signals);
  const sources = await fetchSources(userId, providerIds, profile, mood, runtime);

  // Anything the user has seen or dismissed never shows (cached here as of
  // this build; the page filters again with fresh data on every request).
  const seenOrDismissed = new Set(signals.map((s) => s.tmdbId));
  const watchlistIds = new Set(sources.watchlist.map((w) => w.id));
  const used = new Set<number>();

  const rank = (list: Candidate[]) =>
    [...new Map(list.map((c) => [c.id, c])).values()]
      .filter((c) => !seenOrDismissed.has(c.id))
      .map((c) => ({ c, score: scoreFilm(c, profile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SOURCE_CAP)
      .map((x) => x.c);

  const take = (list: Candidate[], opts: { allowWatchlist?: boolean; allowSeen?: boolean } = {}) => {
    const picked: Candidate[] = [];
    for (const c of opts.allowSeen ? list : rank(list)) {
      if (picked.length >= ROW_SIZE + ROW_OVERFILL) break;
      if (used.has(c.id)) continue;
      if (!opts.allowWatchlist && watchlistIds.has(c.id)) continue;
      used.add(c.id);
      picked.push(c);
    }
    return picked;
  };

  const peopleNames = profile.people.map((p) => p.name);
  const draft: { key: string; title: string; subtitle?: string; films: Candidate[]; reasons?: boolean }[] = [];

  if (mood?.id === "comfort") {
    draft.push({
      key: "favourites",
      title: "Old favourites on your services",
      subtitle: "Films you rated 4★ or more",
      films: take(sources.favourites, { allowSeen: true }),
    });
  }
  draft.push({
    key: "watchlist",
    title: "Your watchlist, now streaming",
    subtitle: "Films you saved that you can watch tonight",
    films: take(sources.watchlist, { allowWatchlist: true }),
  });
  draft.push({
    key: "top",
    title: profile.signalCount >= 5 ? "Top picks for you" : "Popular on your services",
    subtitle:
      profile.signalCount >= 5 ? undefined : "Rate a few films and these become picks for you",
    films: take([
      ...sources.forYou,
      ...sources.gems,
      ...sources.people,
      ...sources.fresh,
      ...sources.seeds.flatMap((s) => s.films),
      ...sources.quick,
    ]).slice(0, ROW_SIZE + ROW_OVERFILL),
    reasons: profile.signalCount >= 5,
  });
  for (const seed of sources.seeds) {
    draft.push({ key: `seed-${seed.title}`, title: `Because you loved ${seed.title}`, films: take(seed.films) });
  }
  draft.push({
    key: "new",
    title: "New on your services",
    subtitle: "Just added or released in the last year",
    films: take(sources.fresh),
  });
  if (peopleNames.length > 0) {
    draft.push({
      key: "people",
      title: "More from people you like",
      subtitle: peopleNames.join(", "),
      films: take(sources.people),
    });
  }
  draft.push({
    key: "gems",
    title: "Hidden gems",
    subtitle: "Well reviewed, not widely seen",
    films: take(sources.gems),
  });
  if (runtime == null) {
    draft.push({ key: "quick", title: "Quick watches", subtitle: "Under 100 minutes", films: take(sources.quick) });
  }

  // Confirm each film really is on one of the user's services, and find
  // out which one for its badge. One cached lookup per film (a day long, see
  // getWatchProviders), shared with every other page that shows the film.
  const providerSet = new Set(providerIds);
  const allIds = [...new Set(draft.flatMap((r) => r.films.map((f) => f.id)))];
  const providersById = new Map<number, number[]>();
  await Promise.all(
    allIds.map(async (id) => {
      const providers = await getFlatrateProviders(id);
      providersById.set(
        id,
        providers.map((p) => p.provider_id).filter((pid) => providerSet.has(pid))
      );
    })
  );

  const rows: DiscoverRowData[] = draft
    .map((row) => ({
      key: row.key,
      title: row.title,
      subtitle: row.subtitle,
      films: row.films
        .map((c) => ({ ...toFilm(c, profile, !!row.reasons), providerIds: providersById.get(c.id) ?? [] }))
        .filter((f) => f.providerIds.length > 0)
        .slice(0, ROW_SIZE),
    }))
    .filter((row) => row.films.length >= ROW_MIN);

  return {
    rows,
    services: serviceList,
    signalCount: profile.signalCount,
    topGenres: profile.topGenres.slice(0, 3).map((id) => GENRE_NAMES[id]).filter(Boolean),
  };
}

export function discoverCacheTag(userId: string) {
  return `discover:${userId}`;
}

/**
 * The Discover feed for one user, mood and runtime limit. The expensive
 * part is cached for a few hours per combination; what the user has seen,
 * dismissed or watchlisted since is applied fresh on every request, so a
 * "Not for me" never comes back on the next load.
 */
export async function getDiscoverFeed(
  userId: string,
  mood: Mood | null,
  runtime: RuntimeLimit | null
): Promise<DiscoverFeed> {
  // The user's services are part of the cache key, so adding or removing a
  // service rebuilds the feed straight away instead of up to three hours
  // later. One small indexed query.
  const serviceKey = (
    await prisma.streamingService.findMany({ where: { userId }, select: { providerId: true } })
  )
    .map((s) => s.providerId)
    .sort((a, b) => a - b)
    .join(",");
  const [feed, watched, dismissedRows, watchlist] = await Promise.all([
    unstable_cache(
      () => buildFeed(userId, mood, runtime),
      ["discover-feed-v2", userId, mood?.id ?? "all", String(runtime ?? "any"), serviceKey],
      { revalidate: FEED_CACHE_SECONDS, tags: [discoverCacheTag(userId)] }
    )(),
    getWatchedTmdbIds(userId),
    prisma.dismissedMovie.findMany({ where: { userId }, select: { movie: { select: { tmdbId: true } } } }),
    getUserWatchlistedTmdbIds(userId),
  ]);
  const dismissed = new Set(dismissedRows.map((d) => d.movie.tmdbId));

  const rows = feed.rows
    .map((row) => ({
      ...row,
      films: row.films.filter(
        (f) => !dismissed.has(f.id) && (row.key === "favourites" || !watched.has(f.id))
      ),
    }))
    .filter((row) => row.films.length > 0);

  return { ...feed, rows, watchlistIds: [...watchlist] };
}
