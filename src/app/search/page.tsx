import { auth } from "@/auth";
import { searchMovies } from "@/lib/tmdb";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { SearchResultsGrid } from "@/components/SearchResultsGrid";
import { Pagination } from "@/components/Pagination";

// TMDB never returns more than 500 pages for any query, regardless of total_results.
const MAX_PAGE = 500;

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [results, session] = await Promise.all([
    query ? searchMovies(query, page) : null,
    auth(),
  ]);

  const [posterOverrides, ownedIds, watchlistIds, watchedIds] = await Promise.all([
    getCustomPosterMap(session?.user?.id, results?.results.map((m) => m.id) ?? []),
    getUserOwnedTmdbIds(session?.user?.id),
    getUserWatchlistedTmdbIds(session?.user?.id),
    getWatchedTmdbIds(session?.user?.id),
  ]);
  const movies = applyPosterOverrides(results?.results ?? [], posterOverrides);
  const totalPages = results ? Math.min(results.total_pages, MAX_PAGE) : 0;

  function pageHref(targetPage: number) {
    return `/search?q=${encodeURIComponent(query)}&page=${targetPage}`;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">
        {query ? `Results for "${query}"` : "Search"}
      </h1>

      {/* The no-query case needs its own branch: landing on /search with
          nothing typed left `results` null, which skipped the "No movies
          found" line and rendered an empty grid — a blank page under the
          heading with no explanation. */}
      {!query ? (
        <p className="text-muted">Search for a movie by title to get started.</p>
      ) : results && results.results.length === 0 ? (
        <p className="text-muted">No movies found.</p>
      ) : (
        <SearchResultsGrid
          movies={movies}
          ownedIds={[...ownedIds]}
          watchlistIds={[...watchlistIds]}
          watchedIds={[...watchedIds]}
        />
      )}

      {results && <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />}
    </div>
  );
}
