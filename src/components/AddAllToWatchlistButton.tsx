"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function AddAllToWatchlistButton({
  endpoint,
  body,
  emptyMessage = "There's nothing here to add.",
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      setSaving(false);
      showToast("Couldn't add these to your watchlist.", "error");
      return;
    }

    const result = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(result?.error ?? "Couldn't add these to your watchlist.", "error");
      return;
    }

    // Films already watched are deliberately left off (see addToWatchlist),
    // so they get named here — otherwise adding a 250-film list and getting
    // 180 looks like something silently failed.
    const skipped = result.skippedWatched ?? 0;
    const skippedNote = skipped > 0 ? ` (skipped ${skipped} you've already watched)` : "";

    if (result.added === 0) {
      showToast(
        result.total === 0
          ? emptyMessage
          : skipped > 0
            ? "Everything here is either already on your watchlist or already watched."
            : "Every movie here is already on your watchlist."
      );
    } else {
      showToast(
        `Added ${result.added} movie${result.added === 1 ? "" : "s"} to your watchlist${skippedNote}`
      );
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={saving}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors disabled:opacity-50"
    >
      {saving ? "Adding..." : "+ Add all to watchlist"}
    </button>
  );
}
