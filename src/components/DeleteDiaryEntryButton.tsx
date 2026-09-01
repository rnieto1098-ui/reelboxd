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

    if (!res.ok) {
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
