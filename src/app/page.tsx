import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  discoverMoviesMultiPage,
  getGenres,
  getPopularMoviesMultiPage,
  getTrendingMoviesMultiPage,
  getUpcomingMovies,
  type TmdbMovieSummary,
} from "@/lib/tmdb";
import { getRecommendationsForUser, getWatchedTmdbIds } from "@/lib/recommendations";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import {
  filterMoviesByStreaming,
  filterRentBuyOnly,
  getUserOwnedTmdbIds,
  getUserProviderIds,
  hasStreamingAvailability,
} from "@/lib/streaming";
import { getHomepageListCards, getCuratedListsProgress } from "@/lib/systemLists";
import { cleanMovieList, isPrimaryGenre } from "@/lib/movieListHygiene";
import { getGoalProgress } from "@/lib/goals";
import { getRecentlyAddedForUser } from "@/lib/providerSnapshot";
import { excludeShortFilms } from "@/lib/runtimeFilter";
import { MovieRow } from "@/components/MovieRow";
import { ListRow } from "@/components/ListRow";
import { UpcomingReleasesRow } from "@/components/UpcomingReleasesRow";
import { CuratedListsProgress } from "@/components/CuratedListsProgress";
import { AvailabilityFilterLinks } from "@/components/AvailabilityFilterLinks";
import { OnboardingChecklist, type ChecklistItem } from "@/components/OnboardingChecklist";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";
import { HomeRowsSkeleton } from "@/components/HomeRowsSkeleton";
import { HeroBillboard, type BillboardItem } from "@/components/HeroBillboard";
import { LandingHero } from "@/components/LandingHero";
import { getSiteSettings } from "@/lib/siteSettings";
import { backdropUrl } from "@/lib/tmdb";
import { currentYearUTC } from "@/lib/dates";

// How many films rotate through the billboard at the top of the page.
const BILLBOARD_COUNT = 6;
// Below this many votes a TMDB average is noise (a handful of 10s), so the
// billboard shows no score at all rather than a misleading one.
const MIN_VOTES_FOR_RATING = 50;

const WELCOME_PHRASES = [
  "Here's what we think you'll love next.",
  "Ready for your next favorite film?",
  "We've got some picks worth your popcorn.",
  "Let's find your next five-star watch.",
  "Curated just for your taste in film.",
];

// TMDB doesn't have a "Superhero" genre — approximating it with the Action
// genre dumped in everything from Lord of the Rings to Facing El Chapo,
// since a fantasy epic or a crime documentary can carry Action as one of
// several tags without being about superheroes at all. TMDB's own keyword
// tagging (id 9715, "superhero") is a real curated signal for this instead.
const SUPERHERO_KEYWORD_ID = 9715;
// The keyword alone still lets in kids' films with a superhero gag (PAW
// Patrol: The Mighty Movie, Despicable Me 4), so the row also excludes
// Animation and Family. TMDB genre ids are fixed.
const ANIMATION_GENRE_ID = 16;
const FAMILY_GENRE_ID = 10751;

// The three genre-based rows below filter on *primary* genre (see
// isPrimaryGenre) rather than "has this genre anywhere in its tags" — a
// with_genres match alone let Despicable Me (Animation, Comedy, Crime, ...)
// into Crime and Cars 3 / Inside Out (Animation, Drama, ...) into Drama,
// genre only as a distant, secondary label.
type GenreRow = {
  title: string;
  genreName?: string;
  keywordId?: number;
  excludeGenreIds?: number[];
};
const GENRE_ROWS: GenreRow[] = [
  {
    title: "Superhero",
    keywordId: SUPERHERO_KEYWORD_ID,
    excludeGenreIds: [ANIMATION_GENRE_ID, FAMILY_GENRE_ID],
  },
  { title: "Comedy", genreName: "Comedy" },
  { title: "Drama", genreName: "Drama" },
  { title: "Crime", genreName: "Crime" },
];

// TMDB pages are 20 movies each. These sizes are raw pool depth, fetched
// before any streaming-availability filter runs — plain rows just get a
// long scroll, but rows the user narrows to "their services" need a much
// bigger pool up front so the filter has enough to keep, instead of
// collapsing down to a handful of movies.
const BASE_ROW_PAGES = 3; // ~60 movies unfiltered
const STREAMING_ROW_PAGES = 8; // ~160 movies to filter down when narrowed
// Extra pages fetched only for the primary-genre-filtered rows (Comedy,
// Drama, Crime) — see the isPrimaryGenre filter below for why they need
// more pool depth than a row that keeps everything it's sent.
const GENRE_ROW_EXTRA_PAGES = 3;
const BASE_RECOMMEND_COUNT = 12;
const STREAMING_RECOMMEND_COUNT = 36;
// Highest Rated and the genre rows barely shift hour to hour, unlike
// Popular/Trending — a longer cache window here cuts TMDB request volume
// without the rows feeling stale.
const SLOW_ROW_CACHE_SECONDS = 6 * 60 * 60; // 6 hours

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { streaming } = await searchParams;
  const streamingOnly = streaming === "1";

  const session = await auth();
  const userId = session?.user?.id;
  // One phrase per user per day. It used to be picked at random on every
  // render, and since every poster click re-renders this page, the line
  // under "Welcome back" changed each time you ticked a film off.
  const welcomePhrase =
    WELCOME_PHRASES[hashString(`${userId ?? ""}:${new Date().toISOString().slice(0, 10)}`) % WELCOME_PHRASES.length];

  const currentYear = currentYearUTC();

  // Everything the page shell (header, goal widget, availability toggle,
  // onboarding checklist) needs is a cheap DB-only lookup — fetched here,
  // outside the Suspense boundary below, so the shell paints immediately
  // instead of waiting on the much heavier TMDB row-fetching chain.
  const [watchedIds, userProviderIds, ownedTmdbIds, watchlistTmdbIds, goal] = await Promise.all([
    getWatchedTmdbIds(userId),
    getUserProviderIds(userId),
    getUserOwnedTmdbIds(userId),
    getUserWatchlistedTmdbIds(userId),
    userId ? getGoalProgress(userId, currentYear) : Promise.resolve(null),
  ]);

  const canFilterByAvailability = hasStreamingAvailability(userProviderIds, ownedTmdbIds);

  // Started here (not awaited) because more than one streamed section needs
  // them: recommendations feed For You, Popular's exclusions and Discover;
  // the watchlist feeds Coming Soon and Rent or Buy.
  const recommendCount = canFilterByAvailability ? STREAMING_RECOMMEND_COUNT : BASE_RECOMMEND_COUNT;
  const recommendedPromise = getGenres().then((catalog) =>
    getRecommendationsForUser(userId, watchedIds, catalog.genres, recommendCount)
  );
  const watchlistMoviesPromise = loadWatchlistMovies(userId);

  // Reuses data already fetched above — no extra queries just to know
  // whether these are done.
  const onboardingItems: ChecklistItem[] = [
    {
      key: "streaming",
      label: "Add your streaming services (or mark a movie as owned)",
      href: "/streaming",
      done: canFilterByAvailability,
    },
    {
      key: "rate",
      label: "Rate a few movies you've seen",
      href: "/search",
      done: watchedIds.size >= 3,
    },
    {
      key: "watchlist",
      label: "Add something to your watchlist",
      href: "/search",
      done: watchlistTmdbIds.size >= 1,
    },
  ];

  return (
    <div className="space-y-10">
      <Suspense fallback={<HeroSkeleton />}>
        <HomeHero
          isSignedIn={!!session?.user}
          watchedIds={watchedIds}
          watchlistTmdbIds={watchlistTmdbIds}
        />
      </Suspense>

      {session?.user && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title">Welcome back, {session.user.name}.</h1>
            <p className="mt-1 text-muted">{welcomePhrase}</p>
          </div>
          <AvailabilityFilterLinks
            allHref="/"
            streamingHref="/?streaming=1"
            streamingOnly={streamingOnly}
            canFilterByAvailability={canFilterByAvailability}
          />
        </div>
      )}

      {session?.user && goal && (
        <WatchGoalWidget
          year={goal.year}
          target={goal.target}
          count={goal.count}
          percent={goal.percent}
          pace={goal.pace}
          isOwner
          username={session.user.name ?? ""}
        />
      )}

      {session?.user && <OnboardingChecklist items={onboardingItems} />}

      <Suspense fallback={<HomeRowsSkeleton />}>
        <HomeMovieRows
          userId={userId}
          isSignedIn={!!session?.user}
          streamingOnly={streamingOnly}
          watchedIds={watchedIds}
          userProviderIds={userProviderIds}
          ownedTmdbIds={ownedTmdbIds}
          watchlistTmdbIds={watchlistTmdbIds}
          canFilterByAvailability={canFilterByAvailability}
          recommendedPromise={recommendedPromise}
          watchlistMoviesPromise={watchlistMoviesPromise}
          // Discover and Rent or Buy each need a live streaming-availability
          // lookup per film (easily several seconds on a cold cache), so
          // they stream in on their own instead of holding back every other
          // row on the page.
          discoverRow={
            session?.user ? (
              <Suspense fallback={<HomeRowsSkeleton rows={1} />}>
                <DiscoverRow
                  userId={userId}
                  recommendedPromise={recommendedPromise}
                  userProviderIds={userProviderIds}
                  ownedTmdbIds={ownedTmdbIds}
                  watchlistTmdbIds={watchlistTmdbIds}
                  canFilterByAvailability={canFilterByAvailability}
                />
              </Suspense>
            ) : null
          }
          rentBuyRow={
            session?.user ? (
              <Suspense fallback={<HomeRowsSkeleton rows={1} />}>
                <RentBuyRow
                  userId={userId}
                  watchlistMoviesPromise={watchlistMoviesPromise}
                  ownedTmdbIds={ownedTmdbIds}
                  watchlistTmdbIds={watchlistTmdbIds}
                />
              </Suspense>
            ) : null
          }
        />
      </Suspense>
    </div>
  );
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function HeroSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading featured films"
      className="bleed skeleton -mt-8 mb-10 h-[68vh] max-h-[660px] min-h-[440px] rounded-none sm:h-[62vh]"
    />
  );
}

// The panel at the very top of the page. Signed-in members get this week's
// trending films to flick through; visitors get the pitch for the site over
// a still from the top one. Fetches only page one of trending, which the
// rows below request too, so it costs no extra TMDB call.
async function HomeHero({
  isSignedIn,
  watchedIds,
  watchlistTmdbIds,
}: {
  isSignedIn: boolean;
  watchedIds: Set<number>;
  watchlistTmdbIds: Set<number>;
}) {
  const [trending, genreCatalog, settings] = await Promise.all([
    getTrendingMoviesMultiPage("week", 1).catch(() => [] as TmdbMovieSummary[]),
    getGenres().catch(() => ({ genres: [] })),
    getSiteSettings(),
  ]);
  const withArt = trending.filter((m) => m.backdrop_path && m.title);

  if (!isSignedIn) {
    const top = withArt[0];
    return (
      <LandingHero
        // No film still (TMDB unreachable): use one of the site's own backdrops.
        backdrop={top ? backdropUrl(top.backdrop_path) : "/backgrounds/projector-prism.webp"}
        still={
          top ? { id: top.id, title: top.title, year: top.release_date?.slice(0, 4) || null } : null
        }
        signupsOpen={settings.signupsOpen}
      />
    );
  }

  const genreNameById = new Map(genreCatalog.genres.map((g) => [g.id, g.name]));
  const items: BillboardItem[] = withArt
    .filter((m) => !watchedIds.has(m.id))
    .slice(0, BILLBOARD_COUNT)
    .map((m) => ({
      id: m.id,
      title: m.title,
      year: m.release_date?.slice(0, 4) || null,
      overview: m.overview ?? "",
      backdrop: backdropUrl(m.backdrop_path)!,
      rating:
        (m.vote_count ?? 0) >= MIN_VOTES_FOR_RATING && m.vote_average > 0 ? m.vote_average : null,
      genres: (m.genre_ids ?? [])
        .map((id) => genreNameById.get(id))
        .filter((name): name is string => !!name),
      inWatchlist: watchlistTmdbIds.has(m.id),
    }));

  return <HeroBillboard items={items} signedIn />;
}

// Split out from HomePage so the shell above (header, goal widget,
// onboarding) can paint before this — the much heavier part — resolves.
// Most rows still run as one unit (Popular excludes what's already in For
// You); the two slowest, Discover and Rent or Buy, arrive as their own
// streamed slots (discoverRow / rentBuyRow) rendered in their usual places.
async function HomeMovieRows({
  userId,
  isSignedIn,
  streamingOnly,
  watchedIds,
  userProviderIds,
  ownedTmdbIds,
  watchlistTmdbIds,
  canFilterByAvailability,
  recommendedPromise,
  watchlistMoviesPromise,
  discoverRow,
  rentBuyRow,
}: {
  userId: string | undefined;
  isSignedIn: boolean;
  streamingOnly: boolean;
  watchedIds: Set<number>;
  userProviderIds: Set<number>;
  ownedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
  canFilterByAvailability: boolean;
  recommendedPromise: Promise<TmdbMovieSummary[]>;
  watchlistMoviesPromise: Promise<TmdbMovieSummary[]>;
  discoverRow: ReactNode;
  rentBuyRow: ReactNode;
}) {
  const [comingSoonRaw, genreCatalog, listCards, watchlistMoviesRaw, recentlyAddedRaw] = await Promise.all([
    getUpcomingMovies(),
    getGenres(),
    getHomepageListCards(userId),
    watchlistMoviesPromise,
    userId ? getRecentlyAddedForUser(userId, userProviderIds) : Promise.resolve([]),
  ]);

  const applyStreamingFilter = streamingOnly && canFilterByAvailability;
  const rowPages = applyStreamingFilter ? STREAMING_ROW_PAGES : BASE_ROW_PAGES;

  const [popularRaw, trendingRaw] = await Promise.all([
    getPopularMoviesMultiPage(rowPages).then(excludeShortFilms),
    getTrendingMoviesMultiPage("week", rowPages).then(excludeShortFilms),
  ]);

  const recentlyAdded: TmdbMovieSummary[] = recentlyAddedRaw.map((m) => ({
    id: m.tmdbId,
    title: m.title,
    overview: m.overview ?? "",
    poster_path: m.posterPath,
    backdrop_path: m.backdropPath,
    release_date: m.releaseDate ?? "",
    vote_average: m.voteAverage ?? 0,
  }));

  // Watchlist items with a future release date, soonest first — cheap to
  // derive since watchlistMoviesRaw is already fetched above.
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingReleases = watchlistMoviesRaw
    .filter((m) => m.release_date > todayStr)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));

  const genreIdByName = new Map(genreCatalog.genres.map((g) => [g.name, g.id]));

  async function narrow(movies: TmdbMovieSummary[]) {
    return applyStreamingFilter
      ? filterMoviesByStreaming(movies, userProviderIds, ownedTmdbIds)
      : movies;
  }

  // recommendedRaw doesn't depend on anything below, and nothing below
  // depends on it (only the `excludeFromPopular` filter does, after) — so it
  // runs alongside the rest instead of serializing in front of them.
  const [recommendedRaw, highestRatedRaw, ...genreRowsRaw] = await Promise.all([
    recommendedPromise,
    // A high vote-count floor is what actually gets you "universally agreed
    // masterpiece" territory (Shawshank, The Godfather, ...) — the default
    // floor of 100 lets small-but-devoted-fanbase obscurities with a handful
    // of 10/10s outrank real consensus classics.
    discoverMoviesMultiPage(
      { sortBy: "vote_average.desc", minVoteCount: 10000, revalidateSeconds: SLOW_ROW_CACHE_SECONDS },
      rowPages
    ).then(excludeShortFilms),
    ...GENRE_ROWS.map((row) => {
      if (row.keywordId != null) {
        return discoverMoviesMultiPage(
          {
            keywordIds: [row.keywordId],
            excludeGenreIds: row.excludeGenreIds,
            revalidateSeconds: SLOW_ROW_CACHE_SECONDS,
          },
          rowPages
        ).then(excludeShortFilms);
      }
      const genreId = row.genreName ? genreIdByName.get(row.genreName) : undefined;
      if (!genreId) return Promise.resolve([] as TmdbMovieSummary[]);
      // Extra pages up front — filtering to primary genre below throws away
      // a real chunk of each page's raw with_genres matches (e.g. a family
      // animated film tagged Drama fourth), so the fetch needs more pool
      // depth than a row that keeps everything it's sent.
      return discoverMoviesMultiPage(
        { genreIds: [genreId], revalidateSeconds: SLOW_ROW_CACHE_SECONDS },
        rowPages + GENRE_ROW_EXTRA_PAGES
      )
        .then((movies) => movies.filter((m) => isPrimaryGenre(m, genreId)))
        .then(excludeShortFilms);
    }),
  ]);

  const excludeFromPopular = new Set([...watchedIds, ...recommendedRaw.map((m) => m.id)]);
  const popularFilteredRaw = popularRaw.filter((movie) => !excludeFromPopular.has(movie.id));

  const trendingFiltered = trendingRaw.filter((m) => !watchedIds.has(m.id));
  const highestRatedFiltered = highestRatedRaw.filter((m) => !watchedIds.has(m.id));
  const genreRowsFiltered = GENRE_ROWS.map((row, i) => ({
    title: row.title,
    movies: genreRowsRaw[i].filter((m) => !watchedIds.has(m.id)),
  }));

  const [
    recommended,
    popular,
    trending,
    highestRated,
    listsProgress,
    ...genreMoviesNarrowed
  ] = await Promise.all([
    narrow(recommendedRaw),
    narrow(popularFilteredRaw),
    narrow(trendingFiltered),
    narrow(highestRatedFiltered),
    getCuratedListsProgress(userId, watchedIds),
    ...genreRowsFiltered.map((row) => narrow(row.movies)),
  ]);
  const genreRows = genreRowsFiltered.map((row, i) => ({ ...row, movies: genreMoviesNarrowed[i] }));

  const posterOverrides = await getCustomPosterMap(userId, [
    ...recommended.map((m) => m.id),
    ...popular.map((m) => m.id),
    ...trending.map((m) => m.id),
    ...highestRated.map((m) => m.id),
    ...recentlyAdded.map((m) => m.id),
    ...upcomingReleases.map((m) => m.id),
    ...comingSoonRaw.results.map((m) => m.id),
    ...genreRows.flatMap((row) => row.movies.map((m) => m.id)),
  ]);

  // cleanMovieList is the last thing every row passes through before it
  // reaches a card — a final backstop against a title-less TMDB entry (an
  // unannounced/withdrawn placeholder) or the same movie surfacing twice in
  // one row, regardless of which upstream step let it through.
  const recommendedWithPosters = cleanMovieList(applyPosterOverrides(recommended, posterOverrides));
  const popularWithPosters = cleanMovieList(applyPosterOverrides(popular, posterOverrides));
  const trendingWithPosters = cleanMovieList(applyPosterOverrides(trending, posterOverrides));
  const highestRatedWithPosters = cleanMovieList(applyPosterOverrides(highestRated, posterOverrides));
  const recentlyAddedWithPosters = cleanMovieList(applyPosterOverrides(recentlyAdded, posterOverrides));
  // One "Coming Soon" row: the user's own unreleased watchlist films merged
  // into TMDB's upcoming list, in release order. A separate "Upcoming
  // Releases" row usually held only one or two films next to this one.
  const comingSoonWithPosters = cleanMovieList(
    applyPosterOverrides(
      [...upcomingReleases, ...comingSoonRaw.results].sort((a, b) =>
        a.release_date.localeCompare(b.release_date)
      ),
      posterOverrides
    )
  );
  const genreRowsWithPosters = genreRows.map((row) => ({
    ...row,
    movies: cleanMovieList(applyPosterOverrides(row.movies, posterOverrides)),
  }));

  // MovieRow is a Client Component (shuffle needs local state) — Set isn't
  // serializable across that boundary, so these cross it as plain arrays.
  const ownedIdsArray = [...ownedTmdbIds];
  const watchlistIdsArray = [...watchlistTmdbIds];

  return (
    <div className="space-y-10">
      <MovieRow
        title="Popular right now"
        movies={popularWithPosters}
        ownedIds={ownedIdsArray}
        watchlistIds={watchlistIdsArray}
      />
      <MovieRow
        title="Trending this week"
        movies={trendingWithPosters}
        ownedIds={ownedIdsArray}
        watchlistIds={watchlistIdsArray}
      />
      <ListRow title="Lists" lists={listCards} />
      {isSignedIn && (
        <MovieRow
          title="For You"
          movies={recommendedWithPosters}
          emptyMessage="Rate a few movies you liked and we'll start recommending things you haven't seen."
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      )}
      {comingSoonWithPosters.length > 0 && (
        <UpcomingReleasesRow
          title="Coming Soon"
          movies={comingSoonWithPosters}
          ownedIds={ownedTmdbIds}
          watchlistIds={watchlistTmdbIds}
        />
      )}
      {isSignedIn && listsProgress.length > 0 && <CuratedListsProgress lists={listsProgress} />}
      {discoverRow}
      {isSignedIn && recentlyAddedWithPosters.length > 0 && (
        <MovieRow
          title="Recently Added to Your Services"
          movies={recentlyAddedWithPosters}
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      )}
      {rentBuyRow}
      <MovieRow
        title="Highest Rated"
        movies={highestRatedWithPosters}
        ownedIds={ownedIdsArray}
        watchlistIds={watchlistIdsArray}
      />
      {genreRowsWithPosters.map((row) => (
        <MovieRow
          key={row.title}
          title={row.title}
          movies={row.movies}
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      ))}
    </div>
  );
}

// The user's watchlist from the local movie cache, in TmdbMovieSummary shape
// (MovieCard/MovieRow only ever read id/title/poster_path/release_date).
async function loadWatchlistMovies(userId: string | undefined): Promise<TmdbMovieSummary[]> {
  if (!userId) return [];
  const rows = await prisma.watchlistItem.findMany({
    where: { userId },
    select: {
      movie: {
        select: {
          tmdbId: true,
          title: true,
          overview: true,
          posterPath: true,
          backdropPath: true,
          releaseDate: true,
          voteAverage: true,
        },
      },
    },
  });
  return rows.map((w) => ({
    id: w.movie.tmdbId,
    title: w.movie.title,
    overview: w.movie.overview ?? "",
    poster_path: w.movie.posterPath,
    backdrop_path: w.movie.backdropPath,
    release_date: w.movie.releaseDate ?? "",
    vote_average: w.movie.voteAverage ?? 0,
  }));
}

// Personalized picks the user can watch right now. Unlike the other rows,
// this always filters to the user's services regardless of the "Showing"
// toggle; that's the whole point of "Discover".
async function DiscoverRow({
  userId,
  recommendedPromise,
  userProviderIds,
  ownedTmdbIds,
  watchlistTmdbIds,
  canFilterByAvailability,
}: {
  userId: string | undefined;
  recommendedPromise: Promise<TmdbMovieSummary[]>;
  userProviderIds: Set<number>;
  ownedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
  canFilterByAvailability: boolean;
}) {
  const recommendedRaw = await recommendedPromise;
  const discover = canFilterByAvailability
    ? await filterMoviesByStreaming(recommendedRaw, userProviderIds, ownedTmdbIds)
    : [];
  const posterOverrides = await getCustomPosterMap(
    userId,
    discover.map((m) => m.id)
  );

  const discoverEmptyMessage = !canFilterByAvailability ? (
    <>
      <Link href="/streaming" className="font-medium text-accent-green underline-offset-2 hover:underline">
        Add your streaming services
      </Link>{" "}
      to see personalized picks you can actually watch right now.
    </>
  ) : recommendedRaw.length === 0 ? (
    "Rate a few movies you liked and we'll start recommending things you haven't seen."
  ) : (
    "Nothing you own or have streaming matches your taste yet — check back soon."
  );

  return (
    <MovieRow
      title="Discover"
      movies={cleanMovieList(applyPosterOverrides(discover, posterOverrides))}
      emptyMessage={discoverEmptyMessage}
      ownedIds={[...ownedTmdbIds]}
      watchlistIds={[...watchlistTmdbIds]}
    />
  );
}

// Watchlist films only available to rent or buy right now. Hidden for an
// empty watchlist, as before it streamed separately.
async function RentBuyRow({
  userId,
  watchlistMoviesPromise,
  ownedTmdbIds,
  watchlistTmdbIds,
}: {
  userId: string | undefined;
  watchlistMoviesPromise: Promise<TmdbMovieSummary[]>;
  ownedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
}) {
  const watchlistMovies = await watchlistMoviesPromise;
  if (watchlistMovies.length === 0) return null;
  const rentBuy = await filterRentBuyOnly(watchlistMovies);
  const posterOverrides = await getCustomPosterMap(
    userId,
    rentBuy.map((m) => m.id)
  );
  return (
    <MovieRow
      title="Rent or Buy"
      movies={cleanMovieList(applyPosterOverrides(rentBuy, posterOverrides))}
      emptyMessage="Nothing on your watchlist currently needs to be rented or bought."
      ownedIds={[...ownedTmdbIds]}
      watchlistIds={[...watchlistTmdbIds]}
    />
  );
}
