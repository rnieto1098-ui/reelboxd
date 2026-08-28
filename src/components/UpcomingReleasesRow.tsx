import { MovieCard } from "@/components/MovieCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { TmdbMovieSummary } from "@/lib/tmdb";

export function UpcomingReleasesRow({
  movies,
  title = "Upcoming Releases",
}: {
  movies: TmdbMovieSummary[];
  title?: string;
}) {
  return (
    <HorizontalScroller title={title} isEmpty={movies.length === 0}>
      {movies.map((movie) => (
        <div key={movie.id} className="w-24 flex-shrink-0 sm:w-28">
          <MovieCard
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            year={new Date(movie.release_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        </div>
      ))}
    </HorizontalScroller>
  );
}
