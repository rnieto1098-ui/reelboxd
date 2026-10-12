"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUND_PRESETS, NO_BACKGROUND } from "@/lib/backgrounds";

const tileClass =
  "group relative aspect-video overflow-hidden rounded-md border-2 bg-background transition-colors disabled:opacity-50";

// `selected` is a preset id, "none", or "upload" (the user's own image, which
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

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BACKGROUND_PRESETS.map((preset) => {
          const active = current === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => choose(preset.id)}
              className={`${tileClass} ${active ? "border-accent-green" : "border-border hover:border-muted"}`}
            >
              <Image
                src={preset.src}
                alt=""
                fill
                sizes="(min-width: 640px) 140px, 45vw"
                className="object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-left text-[11px] text-foreground">
                {preset.name}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={current === NO_BACKGROUND}
          onClick={() => choose(NO_BACKGROUND)}
          className={`${tileClass} ${current === NO_BACKGROUND ? "border-accent-green" : "border-border hover:border-muted"}`}
        >
          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-left text-[11px] text-foreground">
            Plain
          </span>
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
