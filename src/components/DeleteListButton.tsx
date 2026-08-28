"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteListButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    router.push("/lists");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-muted hover:text-red-400"
      >
        Delete list
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted">Delete this list?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-400 hover:underline disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Yes, delete"}
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
