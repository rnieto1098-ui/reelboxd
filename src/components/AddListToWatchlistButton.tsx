"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function AddListToWatchlistButton({ listId }: { listId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    const res = await fetch(`/api/lists/${listId}/add-to-watchlist`, { method: "POST" });
    const body = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(body?.error ?? "Couldn't add this list to your watchlist.", "error");
      return;
    }

    if (body.added === 0) {
      showToast(
        body.total === 0 ? "This list is empty." : "Every movie here is already on your watchlist."
      );
    } else {
      showToast(
        `Added ${body.added} movie${body.added === 1 ? "" : "s"} to your watchlist`
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
