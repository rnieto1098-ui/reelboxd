"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemoveFromListButton({ listId, tmdbId }: { listId: string; tmdbId: number }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    await fetch(`/api/lists/${listId}/items/${tmdbId}`, { method: "DELETE" });
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
