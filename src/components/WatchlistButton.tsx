"use client";

import { useToggleAction } from "@/lib/useToggleAction";
import { BookmarkIcon } from "@/components/icons";

export function WatchlistButton({
  tmdbId,
  initialInWatchlist,
  signedIn,
}: {
  tmdbId: number;
  initialInWatchlist: boolean;
  signedIn: boolean;
}) {
  const { active: inWatchlist, saving, toggle } = useToggleAction(
    initialInWatchlist,
    `/api/movies/${tmdbId}/watchlist`,
    signedIn,
    ["Added to watchlist", "Removed from watchlist"],
    // A film you've already seen doesn't go on a list of films to see, so
    // the route declines to add it — say so rather than leaving the button
    // lit for something that isn't there.
    (body, attempted) =>
      (body as { blockedByWatched?: boolean })?.blockedByWatched
        ? {
            active: false,
            message: "You've already watched this — it's not going on your watchlist.",
          }
        : { active: attempted }
  );

  return (
    <button
      onClick={toggle}
      disabled={saving}
      type="button"
      aria-pressed={inWatchlist}
      className={`btn ${inWatchlist ? "btn-active" : "btn-secondary"}`}
    >
      <BookmarkIcon />
      {inWatchlist ? "In Watchlist" : "Watchlist"}
    </button>
  );
}
