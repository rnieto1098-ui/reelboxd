"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginHref } from "@/lib/loginHref";
import { BookmarkIcon, EyeIcon, RewatchIcon, ShoppingBagIcon } from "@/components/icons";
import { Ellipsis, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useRewatchIds } from "@/components/RewatchIdsProvider";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";

// Buttons only accept clicks while they are showing. They used to stay
// clickable at opacity 0, and phones never fire the hover that reveals
// them, so a tap on a poster's corner silently toggled watched or owned
// instead of opening the film.
function actionButtonClass(active: boolean, revealed: boolean) {
  const base = `flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-md transition-[background-color,color,transform] duration-150 active:scale-90 disabled:opacity-50 ${
    revealed
      ? "pointer-events-auto"
      : "pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
  }`;
  // Active (owned/watchlisted) stays highlighted, not just on hover —
  // that's the whole point of showing it's already engaged.
  return active
    ? `${base} bg-accent-green text-black hover:bg-accent-green/90`
    : `${base} bg-black/65 text-white ring-1 ring-white/15 hover:bg-accent-green hover:text-black hover:ring-transparent`;
}

export function PosterQuickActions({
  tmdbId,
  initialOwned = false,
  initialInWatchlist = false,
  // Callers that don't actually track watched state (a recommendation row,
  // an upcoming release) pass nothing, which is the right default: those
  // rows are unwatched by construction, never "unknown."
  initialWatched = false,
}: {
  tmdbId: number;
  initialOwned?: boolean;
  initialInWatchlist?: boolean;
  initialWatched?: boolean;
}) {
  const router = useRouter();
  const refresh = useCoalescedRefresh();
  const showToast = useToast();
  const [owned, setOwned] = useState(initialOwned);
  const [ownedSaving, setOwnedSaving] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [watched, setWatched] = useState(initialWatched);
  const [watchedSaving, setWatchedSaving] = useState(false);
  const initialInRewatch = useRewatchIds().has(tmdbId);
  const [inRewatch, setInRewatch] = useState(initialInRewatch);
  const [rewatchSaving, setRewatchSaving] = useState(false);
  // Touch screens have no hover, so there the actions sit behind a small
  // always-visible "more" button that toggles this.
  const [revealed, setRevealed] = useState(false);

  // initialOwned/initialInWatchlist can change out from under this component
  // after a router.refresh() triggered elsewhere on the page (e.g. the same
  // movie's card appears in two rows) — adjusted during render (React's
  // documented pattern for "adjusting state when a prop changes") rather
  // than in a useEffect, so the stale value never paints even for a frame.
  const [prevInitialOwned, setPrevInitialOwned] = useState(initialOwned);
  if (initialOwned !== prevInitialOwned && !ownedSaving) {
    setPrevInitialOwned(initialOwned);
    setOwned(initialOwned);
  }
  const [prevInitialInWatchlist, setPrevInitialInWatchlist] = useState(initialInWatchlist);
  if (initialInWatchlist !== prevInitialInWatchlist && !watchlistSaving) {
    setPrevInitialInWatchlist(initialInWatchlist);
    setInWatchlist(initialInWatchlist);
  }
  const [prevInitialWatched, setPrevInitialWatched] = useState(initialWatched);
  if (initialWatched !== prevInitialWatched && !watchedSaving) {
    setPrevInitialWatched(initialWatched);
    setWatched(initialWatched);
  }
  const [prevInitialInRewatch, setPrevInitialInRewatch] = useState(initialInRewatch);
  if (initialInRewatch !== prevInitialInRewatch && !rewatchSaving) {
    setPrevInitialInRewatch(initialInRewatch);
    setInRewatch(initialInRewatch);
  }

  // Owned/watchlist are real toggles (unlike logging a dated diary watch,
  // new event each click) — clicking again removes it, same as the buttons
  // on the movie page itself. Both flip immediately and roll back on
  // failure, same pattern as useToggleAction (see that file's doc comment
  // for why "flip, then check the response" beats "flip after the response
  // without checking it" — this used to do the latter).
  async function toggleOwned(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const previousOwned = owned;
    setOwned(!previousOwned);
    setOwnedSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/owned`, { method: previousOwned ? "DELETE" : "POST" });
    } catch {
      setOwnedSaving(false);
      setOwned(previousOwned);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    setOwnedSaving(false);
    if (res.status === 401) {
      setOwned(previousOwned);
      router.push(loginHref());
      return;
    }
    if (!res.ok) {
      setOwned(previousOwned);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    refresh();
  }

  async function toggleWatchlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const previousInWatchlist = inWatchlist;
    setInWatchlist(!previousInWatchlist);
    setWatchlistSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/watchlist`, {
        method: previousInWatchlist ? "DELETE" : "POST",
      });
    } catch {
      setWatchlistSaving(false);
      setInWatchlist(previousInWatchlist);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    if (res.status === 401) {
      setWatchlistSaving(false);
      setInWatchlist(previousInWatchlist);
      router.push(loginHref());
      return;
    }
    if (!res.ok) {
      setWatchlistSaving(false);
      setInWatchlist(previousInWatchlist);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    // The route declines to watchlist a film you've already seen, so the
    // optimistic flip has to be taken back and explained — otherwise the
    // bookmark sits lit for something that was never added. Parsed before
    // clearing `saving`, so it can't be re-clicked mid-reconcile.
    const body = await res.json().catch(() => null);
    setWatchlistSaving(false);
    if (body?.blockedByWatched) {
      setInWatchlist(false);
      showToast("You've already watched this — it's not going on your watchlist.");
      return;
    }
    refresh();
  }

  // Marks a film seen without putting a date on it — no diary entry, and
  // (per checkNewlyCompletedChallenges) counts toward genre/crew/list
  // challenges but never a TIMEFRAME one, which needs a date this doesn't
  // have. This is the only quick action here that reads the response body,
  // to surface a challenge-completion toast when this click was the one
  // that finished it, and to reconcile the optimistic flip against the
  // server's answer — a DELETE can still land back on `true` if the film
  // is also rated or logged (see WatchedButton's doc comment).
  async function toggleWatched(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const wasWatched = watched;
    setWatched(!wasWatched);
    setWatchedSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/watched`, {
        method: wasWatched ? "DELETE" : "POST",
      });
    } catch {
      setWatchedSaving(false);
      setWatched(wasWatched);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    if (res.status === 401) {
      setWatchedSaving(false);
      setWatched(wasWatched);
      router.push(loginHref());
      return;
    }
    if (!res.ok) {
      setWatchedSaving(false);
      setWatched(wasWatched);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setWatchedSaving(false);
    setWatched(body?.watched ?? !wasWatched);
    refresh();

    if (!wasWatched) {
      for (const challenge of body?.completedChallenges ?? []) {
        showToast(`Challenge complete: ${challenge.title}`, "celebrate");
      }
    } else if (body?.stillWatchedBecause === "diary") {
      showToast("Still watched — it's logged in your diary.");
    } else if (body?.stillWatchedBecause === "rating") {
      showToast("Still watched — you've rated it.");
    }
  }

  // Independent of watchlist/watched: no "already seen" refusal to reconcile,
  // so this is the same plain flip-and-roll-back as toggleOwned.
  async function toggleRewatch(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const previousInRewatch = inRewatch;
    setInRewatch(!previousInRewatch);
    setRewatchSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/rewatch`, {
        method: previousInRewatch ? "DELETE" : "POST",
      });
    } catch {
      setRewatchSaving(false);
      setInRewatch(previousInRewatch);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    setRewatchSaving(false);
    if (res.status === 401) {
      setInRewatch(previousInRewatch);
      router.push(loginHref());
      return;
    }
    if (!res.ok) {
      setInRewatch(previousInRewatch);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    refresh();
  }

  const rowClass = `pointer-events-none absolute inset-x-0 flex items-center justify-between p-1.5 transition-opacity duration-200 ${
    revealed ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
  }`;

  return (
    <>
      {/* Darkens the poster's edges behind the buttons so they read on any
          artwork. Purely decorative. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65 transition-opacity duration-200 ${
          revealed ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />

      {/* At rest, a small mark on films you've seen. Fades out as the full
          set of buttons fades in. */}
      {watched && !revealed && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-green text-black shadow transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0"
        >
          <EyeIcon className="h-3 w-3" />
        </span>
      )}

      <div className={`${rowClass} top-0`}>
        <button
          type="button"
          title={inRewatch ? "On rewatch list — click to remove" : "Add to rewatch list"}
          aria-label={inRewatch ? "Remove from rewatch list" : "Add to rewatch list"}
          aria-pressed={inRewatch}
          disabled={rewatchSaving}
          onClick={toggleRewatch}
          className={actionButtonClass(inRewatch, revealed)}
        >
          <RewatchIcon />
        </button>
        <button
          type="button"
          title={owned ? "Owned — click to remove" : "Mark as owned"}
          aria-label={owned ? "Remove from owned" : "Mark as owned"}
          aria-pressed={owned}
          disabled={ownedSaving}
          onClick={toggleOwned}
          className={`${actionButtonClass(owned, revealed)} [@media(hover:none)]:mr-9`}
        >
          <ShoppingBagIcon />
        </button>
      </div>

      <div className={`${rowClass} bottom-0`}>
        <button
          type="button"
          title={watched ? "Marked watched — click to undo" : "Mark as watched (no date, no diary entry)"}
          aria-label={watched ? "Unmark watched" : "Mark watched"}
          aria-pressed={watched}
          disabled={watchedSaving}
          onClick={toggleWatched}
          className={actionButtonClass(watched, revealed)}
        >
          <EyeIcon />
        </button>
        <button
          type="button"
          title={inWatchlist ? "On watchlist — click to remove" : "Add to watchlist"}
          aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
          aria-pressed={inWatchlist}
          disabled={watchlistSaving}
          onClick={toggleWatchlist}
          className={actionButtonClass(inWatchlist, revealed)}
        >
          <BookmarkIcon />
        </button>
      </div>

      {/* Touch only: the way in to the actions above. */}
      <button
        type="button"
        aria-label={revealed ? "Hide quick actions" : "Show quick actions"}
        aria-expanded={revealed}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setRevealed((v) => !v);
        }}
        className="absolute right-1.5 top-1.5 hidden h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/15 backdrop-blur-md active:scale-90 [@media(hover:none)]:flex"
      >
        {revealed ? <X aria-hidden className="h-4 w-4" /> : <Ellipsis aria-hidden className="h-4 w-4" />}
      </button>
    </>
  );
}
