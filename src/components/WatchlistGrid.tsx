"use client";

import { useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ProviderLogos } from "@/components/ProviderLogos";

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
  providers: { provider_id: number; provider_name: string; logo_path: string }[];
  owned?: boolean;
};

function shuffled<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function WatchlistGrid({ entries }: { entries: WatchlistGridEntry[] }) {
  const [order, setOrder] = useState(entries);
  // entries is a new array every server render (tab switch, sort change,
  // or a fresh page load) — reset to that order instead of carrying a
  // stale shuffle across it, so shuffling only ever affects the tab/sort
  // you triggered it from.
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {order.map(({ item, providers, owned }) => (
          <div key={item.id}>
            <MovieCard
              tmdbId={item.movie.tmdbId}
              title={item.movie.title}
              posterPath={item.movie.customPosters[0]?.posterPath ?? item.movie.posterPath}
              year={item.movie.releaseDate?.slice(0, 4)}
              owned={owned}
              inWatchlist
            />
            {owned ? (
              <span className="mt-1 inline-block rounded-full border border-accent-green px-2 py-0.5 text-xs text-accent-green">
                Owned
              </span>
            ) : (
              <ProviderLogos providers={providers} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
