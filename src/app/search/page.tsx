import Link from "next/link";
import { auth } from "@/auth";
import { searchMovies } from "@/lib/tmdb";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { MovieCard } from "@/components/MovieCard";

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

  const [posterOverrides, ownedIds, watchlistIds] = await Promise.all([
    getCustomPosterMap(session?.user?.id, results?.results.map((m) => m.id) ?? []),
    getUserOwnedTmdbIds(session?.user?.id),
    getUserWatchlistedTmdbIds(session?.user?.id),
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

      {results && results.results.length === 0 && (
        <p className="text-muted">No movies found.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {movies.map((movie) => (
          <MovieCard
            key={movie.id}
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            year={movie.release_date?.slice(0, 4)}
            owned={ownedIds.has(movie.id)}
            inWatchlist={watchlistIds.has(movie.id)}
          />
        ))}
      </div>

      {results && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-full px-3 py-1 text-muted hover:text-foreground transition-colors"
            >
              ← Prev
            </Link>
          ) : (
            <span className="rounded-full px-3 py-1 text-muted/40">← Prev</span>
          )}
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-full px-3 py-1 text-muted hover:text-foreground transition-colors"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-full px-3 py-1 text-muted/40">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
