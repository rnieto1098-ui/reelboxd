"use client";

import { MovieCard } from "@/components/MovieCard";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";

export type OwnedGridEntry = {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | undefined;
  // All three describe the person looking at the page, who is not always
  // the person whose collection it is.
  owned: boolean;
  inWatchlist: boolean;
  watched: boolean;
};

export function OwnedMovieGrid({ entries }: { entries: OwnedGridEntry[] }) {
  const { order, shuffle } = useShuffle(entries, (e) => e.id);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ShuffleButton onClick={shuffle} disabled={entries.length < 2} />
      </div>
      <div className="poster-grid">
        {order.map((entry) => (
          <MovieCard
            key={entry.id}
            tmdbId={entry.tmdbId}
            title={entry.title}
            posterPath={entry.posterPath}
            year={entry.year}
            owned={entry.owned}
            inWatchlist={entry.inWatchlist}
            watched={entry.watched}
          />
        ))}
      </div>
    </div>
  );
}
