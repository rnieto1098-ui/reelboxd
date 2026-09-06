"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function DeleteChallengeButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/challenges/${challengeId}`, { method: "DELETE" });
    setDeleting(false);

    // 404 means it's already gone (double-click, or removed in another tab),
    // which is the outcome the user wanted — same handling as the diary
    // entry delete button.
    if (!res.ok && res.status !== 404) {
      showToast("Couldn't remove that challenge — try again.", "error");
      return;
    }

    showToast("Challenge removed");
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
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-400 hover:underline disabled:opacity-50"
      >
        {deleting ? "Removing..." : "Confirm"}
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
