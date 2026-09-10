"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Removes one diary entry, behind a confirm step.
 *
 * The confirm matches DeleteChallengeButton and DeleteListButton — this was
 * the odd one out, firing the DELETE on the first click. A diary entry is
 * just as unrecoverable as the other two (there's no undo, and re-logging
 * invents a new date), and these buttons sit on every row of a dense list,
 * which is exactly where a misclick is easiest.
 */
export function DeleteDiaryEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);

    let res: Response;
    try {
      res = await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
    } catch {
      setRemoving(false);
      showToast("Couldn't remove that entry — try again.", "error");
      return;
    }
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

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-muted hover:text-red-400"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        className="text-red-400 hover:underline disabled:opacity-50"
      >
        {removing ? "Removing..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-muted hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
