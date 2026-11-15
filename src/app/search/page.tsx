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
import { Search } from "lucide-react";
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
      <h1 className="page-title mb-4">{query ? `Results for “${query}”` : "Search"}</h1>

      {/* A full-width search field on the page itself. The only way to search
          used to be the box in the header, which is about a hundred pixels
          wide on a phone, and this page (where the phone tab bar's Search
          button lands) had no field at all. A plain GET form: it works
          before any JavaScript loads and the result is a shareable URL. */}
      <form action="/search" role="search" className="relative mb-8 max-w-2xl">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          name="q"
          defaultValue={query}
          // Only when arriving with nothing typed, so following a link to a
          // set of results doesn't pop the keyboard up over them on a phone.
          autoFocus={!query}
          placeholder="Search films and people"
          aria-label="Search films and people"
          enterKeyHint="search"
          className="input h-12 rounded-full pl-12 pr-28 text-base"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-4"
        >
          Search
        </button>
      </form>

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

      {people.length > 0 && <h2 className="section-title mb-3">Movies</h2>}

      {!query ? (
        <p className="text-muted">
          Type a title, an actor or a director. You can also press{" "}
          <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs">/</kbd> on any
          page to jump to search.
        </p>
      ) : results && results.results.length === 0 ? (
        <div className="rounded-[0.875rem] border border-dashed border-border-strong px-6 py-10 text-center">
          <p className="font-semibold">No films match “{query}”</p>
          <p className="mt-1 text-sm text-muted">
            Check the spelling, or try fewer words. Searching by the film&apos;s original
            title can help with foreign-language films.
          </p>
        </div>
      ) : (
        <SearchResultsGrid
          movies={movies}
          ownedIds={movies.filter((m) => ownedIds.has(m.id)).map((m) => m.id)}
          watchlistIds={movies.filter((m) => watchlistIds.has(m.id)).map((m) => m.id)}
          watchedIds={movies.filter((m) => watchedIds.has(m.id)).map((m) => m.id)}
        />
      )}

      {results && <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} />}
    </div>
  );
}
