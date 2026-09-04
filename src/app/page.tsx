import { Suspense } from "react";
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

const WELCOME_PHRASES = [
  "Here's what we think you'll love next.",
  "Ready for your next favorite film?",
  "We've got some picks worth your popcorn.",
  "Let's find your next five-star watch.",
  "Curated just for your taste in film.",
];

// TMDB doesn't have a "Superhero" genre, so it's approximated with Action.
const GENRE_ROWS = [
  { title: "Superhero", genreName: "Action" },
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
  // A different phrase per page load is the point — this is a Server
  // Component that runs fresh per request, not a client render the
  // purity rule needs to protect from re-render flicker.
  // eslint-disable-next-line react-hooks/purity -- intentional per-request randomness in a Server Component
  const welcomePhrase = WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)];

  const currentYear = new Date().getFullYear();

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
      {session?.user && (
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session.user.name}.</h1>
          <p className="mt-1 text-muted">{welcomePhrase}</p>
        </div>
      )}

      {session?.user && goal && (
        <WatchGoalWidget
          year={goal.year}
          target={goal.target}
          count={goal.count}
          percent={goal.percent}
          isOwner
          username={session.user.name ?? ""}
        />
      )}

      {session?.user && (
        <AvailabilityFilterLinks
          allHref="/"
          streamingHref="/?streaming=1"
          streamingOnly={streamingOnly}
          canFilterByAvailability={canFilterByAvailability}
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
        />
      </Suspense>
    </div>
  );
}

// Split out from HomePage so the shell above (header, goal widget,
// onboarding) can paint before this — the much heavier part — resolves.
// Everything in here still runs as one unit: the rows have real
// cross-dependencies (Popular excludes what's already in For You, poster
// overrides are looked up once for everything together) that aren't worth
// untangling just to stream each row independently.
async function HomeMovieRows({
  userId,
  isSignedIn,
  streamingOnly,
  watchedIds,
  userProviderIds,
  ownedTmdbIds,
  watchlistTmdbIds,
  canFilterByAvailability,
}: {
  userId: string | undefined;
  isSignedIn: boolean;
  streamingOnly: boolean;
  watchedIds: Set<number>;
  userProviderIds: Set<number>;
  ownedTmdbIds: Set<number>;
  watchlistTmdbIds: Set<number>;
  canFilterByAvailability: boolean;
}) {
  const [comingSoonRaw, genreCatalog, listCards, watchlistRows, recentlyAddedRaw] = await Promise.all([
    getUpcomingMovies(),
    getGenres(),
    getHomepageListCards(userId),
    userId
      ? prisma.watchlistItem.findMany({
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
        })
      : Promise.resolve([]),
    userId ? getRecentlyAddedForUser(userId, userProviderIds) : Promise.resolve([]),
  ]);

  const applyStreamingFilter = streamingOnly && canFilterByAvailability;
  const rowPages = applyStreamingFilter ? STREAMING_ROW_PAGES : BASE_ROW_PAGES;
  const recommendCount = canFilterByAvailability ? STREAMING_RECOMMEND_COUNT : BASE_RECOMMEND_COUNT;

  const [popularRaw, trendingRaw] = await Promise.all([
    getPopularMoviesMultiPage(rowPages).then(excludeShortFilms),
    getTrendingMoviesMultiPage("week", rowPages).then(excludeShortFilms),
  ]);

  // Stubbed into TmdbMovieSummary shape from the local cache snapshot —
  // MovieCard/MovieRow only ever read id/title/poster_path/release_date.
  const watchlistMoviesRaw: TmdbMovieSummary[] = watchlistRows.map((w) => ({
    id: w.movie.tmdbId,
    title: w.movie.title,
    overview: w.movie.overview ?? "",
    poster_path: w.movie.posterPath,
    backdrop_path: w.movie.backdropPath,
    release_date: w.movie.releaseDate ?? "",
    vote_average: w.movie.voteAverage ?? 0,
  }));

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
    getRecommendationsForUser(userId, watchedIds, genreCatalog.genres, recommendCount),
    // A high vote-count floor is what actually gets you "universally agreed
    // masterpiece" territory (Shawshank, The Godfather, ...) — the default
    // floor of 100 lets small-but-devoted-fanbase obscurities with a handful
    // of 10/10s outrank real consensus classics.
    discoverMoviesMultiPage(
      { sortBy: "vote_average.desc", minVoteCount: 10000, revalidateSeconds: SLOW_ROW_CACHE_SECONDS },
      rowPages
    ).then(excludeShortFilms),
    ...GENRE_ROWS.map((row) => {
      const genreId = genreIdByName.get(row.genreName);
      return genreId
        ? discoverMoviesMultiPage(
            { genreIds: [genreId], revalidateSeconds: SLOW_ROW_CACHE_SECONDS },
            rowPages
          ).then(excludeShortFilms)
        : Promise.resolve([] as TmdbMovieSummary[]);
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
    discover,
    rentBuy,
    listsProgress,
    ...genreMoviesNarrowed
  ] = await Promise.all([
    narrow(recommendedRaw),
    narrow(popularFilteredRaw),
    narrow(trendingFiltered),
    narrow(highestRatedFiltered),
    // Unlike the other rows, this one always filters to the user's
    // services regardless of the "Showing" toggle above — that's the
    // whole point of "Discover": personalized picks you can watch right
    // now, not just when the global filter happens to be on.
    canFilterByAvailability
      ? filterMoviesByStreaming(recommendedRaw, userProviderIds, ownedTmdbIds)
      : Promise.resolve([] as TmdbMovieSummary[]),
    filterRentBuyOnly(watchlistMoviesRaw),
    getCuratedListsProgress(userId, watchedIds),
    ...genreRowsFiltered.map((row) => narrow(row.movies)),
  ]);
  const genreRows = genreRowsFiltered.map((row, i) => ({ ...row, movies: genreMoviesNarrowed[i] }));

  const posterOverrides = await getCustomPosterMap(userId, [
    ...recommended.map((m) => m.id),
    ...popular.map((m) => m.id),
    ...trending.map((m) => m.id),
    ...highestRated.map((m) => m.id),
    ...discover.map((m) => m.id),
    ...rentBuy.map((m) => m.id),
    ...recentlyAdded.map((m) => m.id),
    ...upcomingReleases.map((m) => m.id),
    ...comingSoonRaw.results.map((m) => m.id),
    ...genreRows.flatMap((row) => row.movies.map((m) => m.id)),
  ]);

  const recommendedWithPosters = applyPosterOverrides(recommended, posterOverrides);
  const popularWithPosters = applyPosterOverrides(popular, posterOverrides);
  const trendingWithPosters = applyPosterOverrides(trending, posterOverrides);
  const highestRatedWithPosters = applyPosterOverrides(highestRated, posterOverrides);
  const discoverWithPosters = applyPosterOverrides(discover, posterOverrides);
  const rentBuyWithPosters = applyPosterOverrides(rentBuy, posterOverrides);
  const recentlyAddedWithPosters = applyPosterOverrides(recentlyAdded, posterOverrides);
  const upcomingReleasesWithPosters = applyPosterOverrides(upcomingReleases, posterOverrides);
  const comingSoonWithPosters = applyPosterOverrides(comingSoonRaw.results, posterOverrides);
  const genreRowsWithPosters = genreRows.map((row) => ({
    ...row,
    movies: applyPosterOverrides(row.movies, posterOverrides),
  }));

  const discoverEmptyMessage = !canFilterByAvailability ? (
    <>
      <Link href="/streaming" className="text-accent-green hover:underline">
        Add your streaming services
      </Link>{" "}
      to see personalized picks you can actually watch right now.
    </>
  ) : recommendedRaw.length === 0 ? (
    "Rate a few movies you liked and we'll start recommending things you haven't seen."
  ) : (
    "Nothing you own or have streaming matches your taste yet — check back soon."
  );

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
        <UpcomingReleasesRow title="Coming Soon" movies={comingSoonWithPosters} ownedIds={ownedTmdbIds} />
      )}
      {isSignedIn && listsProgress.length > 0 && <CuratedListsProgress lists={listsProgress} />}
      {isSignedIn && (
        <MovieRow
          title="Discover"
          movies={discoverWithPosters}
          emptyMessage={discoverEmptyMessage}
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      )}
      {isSignedIn && recentlyAddedWithPosters.length > 0 && (
        <MovieRow
          title="Recently Added to Your Services"
          movies={recentlyAddedWithPosters}
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      )}
      {isSignedIn && watchlistMoviesRaw.length > 0 && (
        <MovieRow
          title="Rent or Buy"
          movies={rentBuyWithPosters}
          emptyMessage="Nothing on your watchlist currently needs to be rented or bought."
          ownedIds={ownedIdsArray}
          watchlistIds={watchlistIdsArray}
        />
      )}
      {isSignedIn && upcomingReleasesWithPosters.length > 0 && (
        <UpcomingReleasesRow movies={upcomingReleasesWithPosters} ownedIds={ownedTmdbIds} />
      )}
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
