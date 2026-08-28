import type { ReactNode } from "react";
import { MovieCard } from "@/components/MovieCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { TmdbMovieSummary } from "@/lib/tmdb";

export function MovieRow({
  title,
  movies,
  emptyMessage,
}: {
  title: string;
  movies: TmdbMovieSummary[];
  emptyMessage?: ReactNode;
}) {
  return (
    <HorizontalScroller title={title} isEmpty={movies.length === 0} emptyMessage={emptyMessage}>
      {movies.map((movie) => (
        <div key={movie.id} className="w-24 flex-shrink-0 sm:w-28">
          <MovieCard
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            year={movie.release_date?.slice(0, 4)}
          />
        </div>
      ))}
    </HorizontalScroller>
  );
}
