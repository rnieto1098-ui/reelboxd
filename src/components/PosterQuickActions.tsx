"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { posterUrl, type TmdbImage } from "@/lib/tmdb";
import { BookmarkIcon, CalendarIcon, DiscIcon, ImageIcon } from "@/components/icons";

type ActionState = "idle" | "saving" | "done";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
      <path d="M5 12l5 5L19 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const quickActionButtonClass =
  "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-accent-green hover:text-black disabled:opacity-50";

export function PosterQuickActions({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const [diaryState, setDiaryState] = useState<ActionState>("idle");
  const [watchlistState, setWatchlistState] = useState<ActionState>("idle");
  const [ownedState, setOwnedState] = useState<ActionState>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posters, setPosters] = useState<TmdbImage[] | null>(null);
  const [loadingPosters, setLoadingPosters] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);

  async function runAction(
    e: React.MouseEvent,
    setState: (s: ActionState) => void,
    url: string,
    body?: unknown
  ) {
    e.preventDefault();
    e.stopPropagation();
    setState("saving");
    const res = await fetch(url, {
      method: "POST",
      ...(body !== undefined && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    setState("done");
    router.refresh();
    setTimeout(() => setState("idle"), 1500);
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
          className={quickActionButtonClass}
        >
          <ImageIcon />
        </button>
        <button
          type="button"
          title="Mark as owned"
          aria-label="Mark as owned"
          disabled={ownedState === "saving"}
          onClick={(e) => runAction(e, setOwnedState, `/api/movies/${tmdbId}/owned`)}
          className={quickActionButtonClass}
        >
          {ownedState === "done" ? <CheckIcon /> : <DiscIcon />}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          title="Log watch"
          aria-label="Log watch"
          disabled={diaryState === "saving"}
          onClick={(e) => runAction(e, setDiaryState, "/api/diary", { tmdbId })}
          className={quickActionButtonClass}
        >
          {diaryState === "done" ? <CheckIcon /> : <CalendarIcon />}
        </button>
        <button
          type="button"
          title="Add to watchlist"
          aria-label="Add to watchlist"
          disabled={watchlistState === "saving"}
          onClick={(e) => runAction(e, setWatchlistState, `/api/movies/${tmdbId}/watchlist`)}
          className={quickActionButtonClass}
        >
          {watchlistState === "done" ? <CheckIcon /> : <BookmarkIcon />}
        </button>
      </div>

      {pickerOpen && (
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
        </div>
      )}
    </>
  );
}
