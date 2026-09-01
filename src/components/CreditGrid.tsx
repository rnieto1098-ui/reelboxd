"use client";

import { useState } from "react";
import { MovieCard } from "@/components/MovieCard";

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

function shuffled<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Client component so "Show all" can expand in place — the section header
// always showed the true count (e.g. "Directing (247)") even though only
// the first 24 ever rendered, with no way to see the rest. Takes plain,
// already-resolved data (not the Maps/Sets used server-side) since props
// crossing the server/client boundary should stay simple, same convention
// as MovieCard/MovieRow elsewhere in this app.
export function CreditGrid({ title, credits }: { title: string; credits: CreditDisplay[] }) {
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState(credits);
  // credits is a new array whenever this department's data actually
  // changes (a different person's page) — reset to that order instead of
  // carrying a stale shuffle across it.
  const [prevCredits, setPrevCredits] = useState(credits);
  if (credits !== prevCredits) {
    setPrevCredits(credits);
    setOrder(credits);
  }

  if (credits.length === 0) return null;

  const shown = expanded ? order : order.slice(0, INITIAL_SHOWN);
  const hasMore = order.length > INITIAL_SHOWN;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {title} <span className="text-sm font-normal text-muted">({credits.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setOrder(shuffled(credits))}
          disabled={credits.length < 2}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground hover:border-accent-green disabled:opacity-50 disabled:hover:text-muted disabled:hover:border-border"
        >
          🔀 Shuffle
        </button>
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
