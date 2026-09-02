"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, type TmdbImage } from "@/lib/tmdb";
import { BookmarkIcon, CalendarIcon, DiscIcon, ImageIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";

type ActionState = "idle" | "saving" | "done";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
      <path d="M5 12l5 5L19 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function actionButtonClass(active: boolean) {
  const base =
    "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors disabled:opacity-50";
  // Active (owned/watchlisted) stays highlighted at rest, not just on
  // hover — that's the whole point of showing it's already engaged.
  return active
    ? `${base} bg-accent-green text-black hover:bg-accent-green/90`
    : `${base} bg-black/70 text-white hover:bg-accent-green hover:text-black`;
}

export function PosterQuickActions({
  tmdbId,
  initialOwned = false,
  initialInWatchlist = false,
}: {
  tmdbId: number;
  initialOwned?: boolean;
  initialInWatchlist?: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [diaryState, setDiaryState] = useState<ActionState>("idle");
  const [owned, setOwned] = useState(initialOwned);
  const [ownedSaving, setOwnedSaving] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posters, setPosters] = useState<TmdbImage[] | null>(null);
  const [loadingPosters, setLoadingPosters] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);

  // initialOwned/initialInWatchlist can change out from under this component
  // after a router.refresh() triggered elsewhere on the page (e.g. the same
  // movie's card appears in two rows) — adjusted during render (React's
  // documented pattern for "adjusting state when a prop changes") rather
  // than in a useEffect, so the stale value never paints even for a frame.
  const [prevInitialOwned, setPrevInitialOwned] = useState(initialOwned);
  if (initialOwned !== prevInitialOwned) {
    setPrevInitialOwned(initialOwned);
    setOwned(initialOwned);
  }
  const [prevInitialInWatchlist, setPrevInitialInWatchlist] = useState(initialInWatchlist);
  if (initialInWatchlist !== prevInitialInWatchlist) {
    setPrevInitialInWatchlist(initialInWatchlist);
    setInWatchlist(initialInWatchlist);
  }

  // Log watch is its own function rather than a generic runAction helper —
  // it's the only quick action that needs to read the response
  // body, to surface a challenge/goal-completion toast when this log was
  // the one that pushed it over. Every other quick action here stays silent
  // on success (see StreamingServiceToggle for the "would spam" reasoning);
  // this one only ever toasts on the rare completion, not on the routine log.
  async function logDiaryWatch(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDiaryState("saving");
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId }),
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setDiaryState("done");
    router.refresh();
    setTimeout(() => setDiaryState("idle"), 1500);

    const body = await res.json().catch(() => null);
    for (const challenge of body?.completedChallenges ?? []) {
      showToast(`🎉 Challenge complete: ${challenge.title}`);
    }
    if (body?.completedGoal) {
      showToast(`🎉 ${body.completedGoal.year} watch goal complete!`);
    }
  }

  // Owned/watchlist are real toggles (unlike Log watch, which just logs a
  // new event each click) — clicking again removes it, same as the buttons
  // on the movie page itself.
  async function toggleOwned(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOwnedSaving(true);
    const res = await fetch(`/api/movies/${tmdbId}/owned`, { method: owned ? "DELETE" : "POST" });
    setOwnedSaving(false);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setOwned((v) => !v);
    router.refresh();
  }

  async function toggleWatchlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setWatchlistSaving(true);
    const res = await fetch(`/api/movies/${tmdbId}/watchlist`, {
      method: inWatchlist ? "DELETE" : "POST",
    });
    setWatchlistSaving(false);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setInWatchlist((v) => !v);
    router.refresh();
  }

  function openPosterPicker(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPickerOpen(true);
    if (posters) return;
    setLoadingPosters(true);
    setPosterError(null);
    fetch(`/api/movies/${tmdbId}/images`)
      .then((res) => res.json())
      .then((data) => setPosters(data.posters ?? []))
      .catch(() => setPosterError("Couldn't load poster options."))
      .finally(() => setLoadingPosters(false));
  }

  async function choosePoster(posterPath: string) {
    setSavingPoster(true);
    const res = await fetch(`/api/movies/${tmdbId}/poster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posterPath }),
    });
    setSavingPoster(false);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setPickerOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Change poster"
          aria-label="Change poster"
          onClick={openPosterPicker}
          className={actionButtonClass(false)}
        >
          <ImageIcon />
        </button>
        <button
          type="button"
          title={owned ? "Owned — click to remove" : "Mark as owned"}
          aria-label="Mark as owned"
          aria-pressed={owned}
          disabled={ownedSaving}
          onClick={toggleOwned}
          className={actionButtonClass(owned)}
        >
          <DiscIcon />
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Log watch"
          aria-label="Log watch"
          disabled={diaryState === "saving"}
          onClick={logDiaryWatch}
          className={actionButtonClass(false)}
        >
          {diaryState === "done" ? <CheckIcon /> : <CalendarIcon />}
        </button>
        <button
          type="button"
          title={inWatchlist ? "On watchlist — click to remove" : "Add to watchlist"}
          aria-label="Add to watchlist"
          aria-pressed={inWatchlist}
          disabled={watchlistSaving}
          onClick={toggleWatchlist}
          className={actionButtonClass(inWatchlist)}
        >
          <BookmarkIcon />
        </button>
      </div>

      {pickerOpen &&
        createPortal(
          // Portaled to <body> — MovieCard's poster wrapper has
          // overflow-hidden (to clip/round the poster image), which would
          // otherwise clip this modal down to the card's own tiny box even
          // though it's position:fixed. The movie page's own poster picker
          // has no such ancestor, which is why only this one needed it.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPickerOpen(false)}
          >
            <div
              className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Choose a poster</h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>

              {loadingPosters && <p className="text-sm text-muted">Loading posters...</p>}
              {posterError && <p className="text-sm text-red-400">{posterError}</p>}

              {posters && posters.length === 0 && (
                <p className="text-sm text-muted">No alternate posters found for this movie.</p>
              )}

              {posters && posters.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {posters.map((img) => (
                    <button
                      key={img.file_path}
                      type="button"
                      disabled={savingPoster}
                      onClick={() => choosePoster(img.file_path)}
                      className="overflow-hidden rounded-md border border-border transition-colors hover:border-accent-green disabled:opacity-50"
                    >
                      <Image
                        src={posterUrl(img.file_path, "w200")!}
                        alt=""
                        width={200}
                        height={300}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
