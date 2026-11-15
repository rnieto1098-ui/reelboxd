"use client";

import { startTransition, useEffect, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";

export type WatchlistGridEntry = {
  item: {
    id: string;
    movie: {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      releaseDate: string | null;
      customPosters: { posterPath: string }[];
    };
  };
  owned?: boolean;
  watched?: boolean;
  inWatchlist?: boolean;
};

// Enough cards to fill a large screen. A watchlist can run to hundreds of
// films, and rendering every card before the page appears made opening the
// tab feel stuck — so the first screenful renders straight away and the
// rest follows in a background transition a moment later.
const INITIAL_CARDS = 48;

export function WatchlistGrid({ entries }: { entries: WatchlistGridEntry[] }) {
  const { order, shuffle } = useShuffle(entries, (e) => e.item.id);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    startTransition(() => setShowAll(true));
  }, []);
  const visible = showAll ? order : order.slice(0, INITIAL_CARDS);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ShuffleButton onClick={shuffle} disabled={entries.length < 2} />
      </div>
      <div className="poster-grid">
        {visible.map(({ item, owned, watched, inWatchlist }) => (
          <div key={item.id}>
            <MovieCard
              tmdbId={item.movie.tmdbId}
              title={item.movie.title}
              posterPath={item.movie.customPosters[0]?.posterPath ?? item.movie.posterPath}
              year={item.movie.releaseDate?.slice(0, 4)}
              owned={owned}
              inWatchlist={inWatchlist}
              watched={watched}
            />
            {owned && (
              <span className="mt-1 inline-block rounded-full border border-accent-green px-2 py-0.5 text-xs text-accent-green">
                Owned
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
