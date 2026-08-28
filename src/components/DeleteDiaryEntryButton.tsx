"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDiaryEntryButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    await fetch(`/api/diary/${entryId}`, { method: "DELETE" });
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
