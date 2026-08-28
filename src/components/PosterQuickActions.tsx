"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkIcon, CalendarIcon } from "@/components/icons";

type ActionState = "idle" | "saving" | "done";

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
      <path d="M5 12l5 5L19 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PosterQuickActions({ tmdbId }: { tmdbId: number }) {
  const router = useRouter();
  const [diaryState, setDiaryState] = useState<ActionState>("idle");
  const [watchlistState, setWatchlistState] = useState<ActionState>("idle");

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

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <button
        type="button"
        title="Log watch"
        aria-label="Log watch"
        disabled={diaryState === "saving"}
        onClick={(e) => runAction(e, setDiaryState, "/api/diary", { tmdbId })}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-accent-green hover:text-black disabled:opacity-50"
      >
        {diaryState === "done" ? <CheckIcon /> : <CalendarIcon />}
      </button>
      <button
        type="button"
        title="Add to watchlist"
        aria-label="Add to watchlist"
        disabled={watchlistState === "saving"}
        onClick={(e) => runAction(e, setWatchlistState, `/api/movies/${tmdbId}/watchlist`)}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-accent-green hover:text-black disabled:opacity-50"
      >
        {watchlistState === "done" ? <CheckIcon /> : <BookmarkIcon />}
      </button>
    </div>
  );
}
