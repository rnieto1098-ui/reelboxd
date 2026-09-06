"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function DeleteDiaryEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
    setRemoving(false);

    // A 404 here almost always means a double-click already removed it a
    // moment ago (the API returns the same 404 for "gone" and "not yours,"
    // but this button only ever renders for entries the viewer owns) — from
    // the user's point of view that's still a successful removal, not an
    // error.
    if (!res.ok && res.status !== 404) {
      showToast("Couldn't remove that entry — try again.", "error");
      return;
    }

    showToast("Diary entry removed");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={removing}
      className="text-xs text-muted hover:text-red-400 disabled:opacity-50"
    >
      {removing ? "Removing..." : "Remove"}
    </button>
  );
}
