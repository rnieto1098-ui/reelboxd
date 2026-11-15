"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export function DeleteChallengeButton({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);

    let res: Response;
    try {
      res = await fetch(`/api/challenges/${challengeId}`, { method: "DELETE" });
    } catch {
      setDeleting(false);
      showToast("Couldn't remove that challenge — try again.", "error");
      return;
    }

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
        aria-label="Remove challenge"
        title="Remove challenge"
        className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 aria-hidden className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="-mr-1.5 -mt-1.5 flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        autoFocus
        className="btn btn-danger btn-sm"
      >
        {deleting ? "Removing…" : "Remove"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
        Keep
      </button>
    </div>
  );
}
