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
  inWatchlist: boolean;
};

export function OwnedMovieGrid({ entries }: { entries: OwnedGridEntry[] }) {
  const { order, shuffle } = useShuffle(entries);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ShuffleButton onClick={shuffle} disabled={entries.length < 2} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {order.map((entry) => (
          <MovieCard
            key={entry.id}
            tmdbId={entry.tmdbId}
            title={entry.title}
            posterPath={entry.posterPath}
            year={entry.year}
            owned
            inWatchlist={entry.inWatchlist}
          />
        ))}
      </div>
    </div>
  );
}
