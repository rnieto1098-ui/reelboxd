"use client";

import { MovieCard } from "@/components/MovieCard";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";

export type RecentlyLoggedEntry = {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year: string | undefined;
  score: number | null;
  logCount: number;
  owned: boolean;
  inWatchlist: boolean;
};

export function RecentlyLoggedRow({ entries }: { entries: RecentlyLoggedEntry[] }) {
  const { order, shuffle } = useShuffle(entries);

  return (
    <HorizontalScroller
      headerAction={entries.length > 1 && <ShuffleButton onClick={shuffle} />}
      isEmpty={entries.length === 0}
      emptyMessage="Nothing logged or rated yet."
    >
      {order.map((e) => (
        <div key={e.id} className="w-24 flex-shrink-0 sm:w-28">
          <MovieCard
            tmdbId={e.tmdbId}
            title={e.title}
            posterPath={e.posterPath}
            year={e.year}
            owned={e.owned}
            inWatchlist={e.inWatchlist}
          />
          <p className="mt-1 text-xs text-accent-green">
            {e.score != null ? `${e.score.toFixed(1)} ★` : "Logged"}
            {e.logCount > 1 ? ` · ${e.logCount}×` : ""}
          </p>
        </div>
      ))}
    </HorizontalScroller>
  );
}
