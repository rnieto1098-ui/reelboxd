"use client";

import { MovieCard } from "@/components/MovieCard";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";
import type { TmdbMovieSummary } from "@/lib/tmdb";

export function SearchResultsGrid({
  movies,
  ownedIds,
  watchlistIds,
}: {
  movies: TmdbMovieSummary[];
  ownedIds: number[];
  watchlistIds: number[];
}) {
  const { order, shuffle } = useShuffle(movies);
  const ownedSet = new Set(ownedIds);
  const watchlistSet = new Set(watchlistIds);

  return (
    <div>
      {movies.length > 1 && (
        <div className="mb-3 flex justify-end">
          <ShuffleButton onClick={shuffle} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {order.map((movie) => (
          <MovieCard
            key={movie.id}
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            year={movie.release_date?.slice(0, 4)}
            owned={ownedSet.has(movie.id)}
            inWatchlist={watchlistSet.has(movie.id)}
          />
        ))}
      </div>
    </div>
  );
}
