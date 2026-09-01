"use client";

import { useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { RemoveFromListButton } from "@/components/RemoveFromListButton";

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

function shuffled<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function ListMovieGrid({
  listId,
  entries,
  isOwner,
}: {
  listId: string;
  entries: ListGridEntry[];
  isOwner: boolean;
}) {
  const [order, setOrder] = useState(entries);
  // entries is a new array whenever sort/filter actually changes (a fresh
  // server render) — reset to that order instead of carrying a stale
  // shuffle across it.
  const [prevEntries, setPrevEntries] = useState(entries);
  if (entries !== prevEntries) {
    setPrevEntries(entries);
    setOrder(entries);
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOrder(shuffled(entries))}
          disabled={entries.length < 2}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground hover:border-accent-green disabled:opacity-50 disabled:hover:text-muted disabled:hover:border-border"
        >
          🔀 Shuffle
        </button>
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
