"use client";

import { useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ShuffleButton } from "@/components/ShuffleButton";
import { useShuffle } from "@/lib/useShuffle";

const INITIAL_SHOWN = 24;

export type CreditDisplay = {
  id: number;
  title: string;
  posterPath: string | null;
  year: string | undefined;
  owned: boolean;
  inWatchlist: boolean;
  watched: boolean;
};

// Client component so "Show all" can expand in place — the section header
// always showed the true count (e.g. "Directing (247)") even though only
// the first 24 ever rendered, with no way to see the rest. Takes plain,
// already-resolved data (not the Maps/Sets used server-side) since props
// crossing the server/client boundary should stay simple, same convention
// as MovieCard/MovieRow elsewhere in this app.
export function CreditGrid({ title, credits }: { title: string; credits: CreditDisplay[] }) {
  const [expanded, setExpanded] = useState(false);
  const { order, shuffle } = useShuffle(credits);

  if (credits.length === 0) return null;

  const shown = expanded ? order : order.slice(0, INITIAL_SHOWN);
  const hasMore = order.length > INITIAL_SHOWN;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {title} <span className="text-sm font-normal text-muted">({credits.length})</span>
        </h2>
        <ShuffleButton onClick={shuffle} disabled={credits.length < 2} />
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((credit) => (
          <div key={credit.id} data-watched={credit.watched}>
            <MovieCard
              tmdbId={credit.id}
              title={credit.title}
              posterPath={credit.posterPath}
              year={credit.year}
              owned={credit.owned}
              inWatchlist={credit.inWatchlist}
            />
          </div>
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-sm text-muted hover:text-accent-green hover:underline"
        >
          Show all {credits.length}
        </button>
      )}
    </section>
  );
}
