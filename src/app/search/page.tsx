import { auth } from "@/auth";
import Link from "next/link";
import { searchMovies, searchPeople } from "@/lib/tmdb";
import { matchingPeople } from "@/lib/personMatch";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { cleanMovieList } from "@/lib/movieListHygiene";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { SearchResultsGrid } from "@/components/SearchResultsGrid";
import { Pagination } from "@/components/Pagination";
import { PersonRow } from "@/components/PersonRow";

// TMDB never returns more than 500 pages for any query, regardless of total_results.
const MAX_PAGE = 500;

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // People only on page 1: paging moves through movie results, and the row
  // would otherwise repeat above every page. A failed person search just
  // hides the row rather than breaking movie results.
  const [results, session, peopleResults] = await Promise.all([
    query ? searchMovies(query, page) : null,
    auth(),
    query && page === 1 ? searchPeople(query).catch(() => null) : null,
  ]);
  const people = matchingPeople(peopleResults?.results ?? [], query);

  const [posterOverrides, ownedIds, watchlistIds, watchedIds] = await Promise.all([
    getCustomPosterMap(session?.user?.id, results?.results.map((m) => m.id) ?? []),
    getUserOwnedTmdbIds(session?.user?.id),
    getUserWatchlistedTmdbIds(session?.user?.id),
    getWatchedTmdbIds(session?.user?.id),
  ]);
  const movies = cleanMovieList(applyPosterOverrides(results?.results ?? [], posterOverrides));
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
      {people.length > 0 && (
        <div className="mb-8">
          <PersonRow
            title="People"
            people={people}
            showDepartment
            headerAction={
              <Link
                href={`/crew?q=${encodeURIComponent(query)}`}
                className="text-sm text-muted hover:text-accent-green hover:underline"
              >
                More on Crew
              </Link>
            }
          />
        </div>
      )}

      {people.length > 0 && <h2 className="mb-3 text-lg font-semibold">Movies</h2>}

      {!query ? (
        <p className="text-muted">Search for a movie or person to get started.</p>
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
