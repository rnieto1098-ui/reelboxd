"use client";

import { useMemo, type ReactNode } from "react";
import { MovieCard } from "@/components/MovieCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";
import type { TmdbMovieSummary } from "@/lib/tmdb";

export function MovieRow({
  title,
  movies,
  emptyMessage,
  ownedIds,
  watchlistIds,
  headerExtra,
}: {
  title: string;
  movies: TmdbMovieSummary[];
  emptyMessage?: ReactNode;
  // Plain arrays, not Set — Set isn't serializable across the Server-to-
  // Client Component boundary this component now sits behind.
  ownedIds?: number[];
  watchlistIds?: number[];
  // Extra header content shown alongside the shuffle button (e.g. an
  // import link) — most rows don't need this, so it's optional.
  headerExtra?: ReactNode;
}) {
  const { order, shuffle } = useShuffle(movies);
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  return (
    <HorizontalScroller
      title={title}
      headerAction={
        (movies.length > 1 || headerExtra) && (
          <div className="flex items-center gap-3">
            {headerExtra}
            {movies.length > 1 && <ShuffleButton onClick={shuffle} />}
          </div>
        )
      }
      isEmpty={movies.length === 0}
      emptyMessage={emptyMessage}
    >
      {order.map((movie) => (
        <div key={movie.id} className="w-24 flex-shrink-0 sm:w-28">
          <MovieCard
            tmdbId={movie.id}
            title={movie.title}
            posterPath={movie.poster_path}
            year={movie.release_date?.slice(0, 4)}
            owned={ownedSet.has(movie.id)}
            inWatchlist={watchlistSet.has(movie.id)}
          />
        </div>
      ))}
    </HorizontalScroller>
  );
}
