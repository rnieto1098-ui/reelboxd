"use client";

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
  providers: { provider_id: number; provider_name: string; logo_path: string }[];
  owned?: boolean;
};

export function WatchlistGrid({ entries }: { entries: WatchlistGridEntry[] }) {
  const { order, shuffle } = useShuffle(entries);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ShuffleButton onClick={shuffle} disabled={entries.length < 2} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {order.map(({ item, owned }) => (
          <div key={item.id}>
            <MovieCard
              tmdbId={item.movie.tmdbId}
              title={item.movie.title}
              posterPath={item.movie.customPosters[0]?.posterPath ?? item.movie.posterPath}
              year={item.movie.releaseDate?.slice(0, 4)}
              owned={owned}
              inWatchlist
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
