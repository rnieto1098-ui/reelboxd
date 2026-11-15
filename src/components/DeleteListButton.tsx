"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function DeleteListButton({ listId }: { listId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);

    let res: Response;
    try {
      res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    } catch {
      setDeleting(false);
      showToast("Couldn't delete that list — try again.", "error");
      return;
    }

    setDeleting(false);

    if (!res.ok) {
      showToast("Couldn't delete that list — try again.", "error");
      return;
    }

    showToast("List deleted");
    router.push("/lists");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-ghost btn-sm hover:bg-danger/10 hover:text-danger"
      >
        Delete list
      </button>
    );
  }

  return (
    <div role="alert" className="flex flex-col items-end gap-2 text-sm">
      {/* Deleting a list also deletes every challenge built on it, which
          the old one-line "Delete this list?" never mentioned. */}
      <span className="max-w-[16rem] text-right text-muted">
        Delete this list for good? Any challenge based on it is deleted too.
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="btn btn-danger btn-sm"
        >
          {deleting ? "Deleting…" : "Delete list"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
          Keep
        </button>
      </span>
    </div>
  );
}
