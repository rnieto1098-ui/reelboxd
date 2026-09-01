"use client";

import { MovieCard } from "@/components/MovieCard";
import { RemoveFromListButton } from "@/components/RemoveFromListButton";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";

export type ListGridEntry = {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | undefined;
  owned: boolean;
  inWatchlist: boolean;
  watched: boolean;
};

export function ListMovieGrid({
  listId,
  entries,
  isOwner,
}: {
  listId: string;
  entries: ListGridEntry[];
  isOwner: boolean;
}) {
  const { order, shuffle } = useShuffle(entries);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ShuffleButton onClick={shuffle} disabled={entries.length < 2} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {order.map((entry) => (
          <div key={entry.id} data-watched={entry.watched}>
            <MovieCard
              tmdbId={entry.tmdbId}
              title={entry.title}
              posterPath={entry.posterPath}
              year={entry.year}
              owned={entry.owned}
              inWatchlist={entry.inWatchlist}
            />
            {isOwner && <RemoveFromListButton listId={listId} tmdbId={entry.tmdbId} />}
          </div>
        ))}
      </div>
    </div>
  );
}
