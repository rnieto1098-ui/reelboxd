"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Random pick across the whole watchlist regardless of the active
// available/not-streaming tab — the point is "decide for me," not
// "decide for me within whatever tab happens to be open."
export function WatchlistShuffleButton({ tmdbIds }: { tmdbIds: number[] }) {
  const router = useRouter();
  const [shuffling, setShuffling] = useState(false);

  function handleShuffle() {
    if (tmdbIds.length === 0) return;
    setShuffling(true);
    const pick = tmdbIds[Math.floor(Math.random() * tmdbIds.length)];
    router.push(`/movie/${pick}`);
  }

  return (
    <button
      type="button"
      onClick={handleShuffle}
      disabled={tmdbIds.length === 0 || shuffling}
      className="text-sm text-muted hover:text-accent-green hover:underline disabled:opacity-50 disabled:hover:no-underline disabled:hover:text-muted"
    >
      🔀 Shuffle
    </button>
  );
}
