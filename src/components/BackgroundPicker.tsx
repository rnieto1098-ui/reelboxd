"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUND_PRESETS, MATCH_TAB, NO_BACKGROUND, tabBackground } from "@/lib/backgrounds";

// Four of the per-tab backgrounds, shown as a collage on the "Match each tab" tile.
const MATCH_TAB_PREVIEW = ["/", "/recommend", "/watchlist", "/challenges"].map(
  (path) => tabBackground(path).src
);

const tileClass =
  "group relative aspect-video overflow-hidden rounded-md border-2 bg-background transition-colors disabled:opacity-50";

// `selected` is a preset id, MATCH_TAB, "none", or "upload" (the user's own image, which
// is changed with the upload button next to this grid rather than a tile).
export function BackgroundPicker({ selected }: { selected: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hold the optimistic pick until the refreshed `selected` prop arrives.
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    setPending(null);
  }
  const current = pending ?? selected;

  async function choose(choice: string) {
    if (choice === current) return;
    setPending(choice);
    setError(null);

    let ok = false;
    try {
      const res = await fetch("/api/profile/background", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      ok = res.ok;
    } catch {
      // handled below
    }

    if (!ok) {
      setPending(null);
      setError("Couldn't change the background — try again.");
      return;
    }
    router.refresh();
  }

  const tile = (choice: string, label: string, content?: ReactNode) => {
    const active = current === choice;
    return (
      <button
        key={choice}
        type="button"
        aria-pressed={active}
        onClick={() => choose(choice)}
        className={`${tileClass} ${active ? "border-accent-green" : "border-border hover:border-muted"}`}
      >
        {content}
        <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-left text-[11px] text-foreground">
          {label}
        </span>
      </button>
    );
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tile(
          MATCH_TAB,
          "Match each tab",
          <span className="grid h-full w-full grid-cols-2 grid-rows-2">
            {MATCH_TAB_PREVIEW.map((src) => (
              <span key={src} className="relative">
                <Image src={src} alt="" fill sizes="70px" className="object-cover" />
              </span>
            ))}
          </span>
        )}
        {BACKGROUND_PRESETS.map((preset) =>
          tile(
            preset.id,
            preset.name,
            <Image
              src={preset.src}
              alt=""
              fill
              sizes="(min-width: 640px) 140px, 45vw"
              className="object-cover"
            />
          )
        )}
        {tile(NO_BACKGROUND, "Plain")}
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
