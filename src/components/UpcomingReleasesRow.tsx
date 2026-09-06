import { MovieCard } from "@/components/MovieCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { TmdbMovieSummary } from "@/lib/tmdb";

export function UpcomingReleasesRow({
  movies,
  title = "Upcoming Releases",
  ownedIds,
}: {
  movies: TmdbMovieSummary[];
  title?: string;
  ownedIds?: Set<number>;
}) {
  return (
    <HorizontalScroller title={title} isEmpty={movies.length === 0}>
      {movies.map((movie) => (
        <div key={movie.id} className="w-24 flex-shrink-0 sm:w-28">
          <MovieCard
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            // release_date is TMDB's "YYYY-MM-DD", which Date parses as UTC
            // midnight — formatted in the server's local zone instead, every
            // release renders a day early anywhere behind UTC.
            year={new Date(movie.release_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
            owned={ownedIds?.has(movie.id)}
            inWatchlist
          />
        </div>
      ))}
    </HorizontalScroller>
  );
}
