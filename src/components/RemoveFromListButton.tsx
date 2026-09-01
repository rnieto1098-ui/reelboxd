"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function RemoveFromListButton({ listId, tmdbId }: { listId: string; tmdbId: number }) {
  const router = useRouter();
  const showToast = useToast();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch(`/api/lists/${listId}/items/${tmdbId}`, { method: "DELETE" });
    setRemoving(false);

    if (!res.ok) {
      showToast("Couldn't remove that movie — try again.", "error");
      return;
    }

    showToast("Removed from list");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={removing}
      className="mt-1 text-xs text-muted hover:text-red-400 disabled:opacity-50"
    >
      {removing ? "Removing..." : "Remove"}
    </button>
  );
}
