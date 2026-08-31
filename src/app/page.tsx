import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  discoverMovies,
  getGenres,
  getPopularMovies,
  getTrendingMovies,
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
import { MovieRow } from "@/components/MovieRow";
import { ListRow } from "@/components/ListRow";
import { UpcomingReleasesRow } from "@/components/UpcomingReleasesRow";
import { CuratedListsProgress } from "@/components/CuratedListsProgress";
import { AvailabilityFilterLinks } from "@/components/AvailabilityFilterLinks";

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

  const [
    popularRaw,
    trendingRaw,
    comingSoonRaw,
    watchedIds,
    genreCatalog,
    userProviderIds,
    ownedTmdbIds,
    watchlistTmdbIds,
    listCards,
    watchlistRows,
  ] = await Promise.all([
      getPopularMovies(),
      getTrendingMovies("week"),
      getUpcomingMovies(),
      getWatchedTmdbIds(userId),
      getGenres(),
      getUserProviderIds(userId),
      getUserOwnedTmdbIds(userId),
      getUserWatchlistedTmdbIds(userId),
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

  // Watchlist items with a future release date, soonest first — cheap to
  // derive since watchlistMoviesRaw is already fetched above.
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingReleases = watchlistMoviesRaw
    .filter((m) => m.release_date > todayStr)
    .sort((a, b) => a.release_date.localeCompare(b.release_date));

  const genreIdByName = new Map(genreCatalog.genres.map((g) => [g.name, g.id]));
  const canFilterByAvailability = hasStreamingAvailability(userProviderIds, ownedTmdbIds);
  const applyStreamingFilter = streamingOnly && canFilterByAvailability;

  async function narrow(movies: TmdbMovieSummary[]) {
    return applyStreamingFilter
      ? filterMoviesByStreaming(movies, userProviderIds, ownedTmdbIds)
      : movies;
  }

  // recommendedRaw doesn't depend on anything below, and nothing below
  // depends on it (only the `excludeFromPopular` filter does, after) — so it
  // runs alongside the rest instead of serializing in front of them.
  const [recommendedRaw, highestRatedRaw, ...genreRowsRaw] = await Promise.all([
    getRecommendationsForUser(userId, watchedIds, genreCatalog.genres),
    // A high vote-count floor is what actually gets you "universally agreed
    // masterpiece" territory (Shawshank, The Godfather, ...) — the default
    // floor of 100 lets small-but-devoted-fanbase obscurities with a handful
    // of 10/10s outrank real consensus classics.
    discoverMovies({ sortBy: "vote_average.desc", minVoteCount: 10000 }),
    ...GENRE_ROWS.map((row) => {
      const genreId = genreIdByName.get(row.genreName);
      return genreId
        ? discoverMovies({ genreIds: [genreId] })
        : Promise.resolve({ results: [] as TmdbMovieSummary[] });
    }),
  ]);

  const excludeFromPopular = new Set([...watchedIds, ...recommendedRaw.map((m) => m.id)]);
  const popularFilteredRaw = popularRaw.results.filter(
    (movie) => !excludeFromPopular.has(movie.id)
  );

  const trendingFiltered = trendingRaw.results.filter((m) => !watchedIds.has(m.id));
  const highestRatedFiltered = highestRatedRaw.results.filter((m) => !watchedIds.has(m.id));
  const genreRowsFiltered = GENRE_ROWS.map((row, i) => ({
    title: row.title,
    movies: genreRowsRaw[i].results.filter((m) => !watchedIds.has(m.id)),
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

  return (
    <div className="space-y-10">
      {session?.user && (
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session.user.name}.</h1>
          <p className="mt-1 text-muted">{welcomePhrase}</p>
        </div>
      )}

      {session?.user && (
        <AvailabilityFilterLinks
          allHref="/"
          streamingHref="/?streaming=1"
          streamingOnly={streamingOnly}
          canFilterByAvailability={canFilterByAvailability}
        />
      )}

      <MovieRow
        title="Popular right now"
        movies={popularWithPosters}
        ownedIds={ownedTmdbIds}
        watchlistIds={watchlistTmdbIds}
      />
      <MovieRow
        title="Trending this week"
        movies={trendingWithPosters}
        ownedIds={ownedTmdbIds}
        watchlistIds={watchlistTmdbIds}
      />
      <ListRow title="Lists" lists={listCards} />
      {session?.user && (
        <MovieRow
          title="For You"
          movies={recommendedWithPosters}
          emptyMessage="Rate a few movies you liked and we'll start recommending things you haven't seen."
          ownedIds={ownedTmdbIds}
          watchlistIds={watchlistTmdbIds}
        />
      )}
      {comingSoonWithPosters.length > 0 && (
        <UpcomingReleasesRow title="Coming Soon" movies={comingSoonWithPosters} ownedIds={ownedTmdbIds} />
      )}
      {session?.user && listsProgress.length > 0 && (
        <CuratedListsProgress lists={listsProgress} />
      )}
      {session?.user && (
        <MovieRow
          title="Discover"
          movies={discoverWithPosters}
          emptyMessage={discoverEmptyMessage}
          ownedIds={ownedTmdbIds}
          watchlistIds={watchlistTmdbIds}
        />
      )}
      {session?.user && watchlistMoviesRaw.length > 0 && (
        <MovieRow
          title="Rent or Buy"
          movies={rentBuyWithPosters}
          emptyMessage="Nothing on your watchlist currently needs to be rented or bought."
          ownedIds={ownedTmdbIds}
          watchlistIds={watchlistTmdbIds}
        />
      )}
      {session?.user && upcomingReleasesWithPosters.length > 0 && (
        <UpcomingReleasesRow movies={upcomingReleasesWithPosters} ownedIds={ownedTmdbIds} />
      )}
      <MovieRow
        title="Highest Rated"
        movies={highestRatedWithPosters}
        ownedIds={ownedTmdbIds}
        watchlistIds={watchlistTmdbIds}
      />
      {genreRowsWithPosters.map((row) => (
        <MovieRow
          key={row.title}
          title={row.title}
          movies={row.movies}
          ownedIds={ownedTmdbIds}
          watchlistIds={watchlistTmdbIds}
        />
      ))}
    </div>
  );
}
