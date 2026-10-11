"use client";

import { useToggleAction } from "@/lib/useToggleAction";
import { RewatchIcon } from "@/components/icons";

export function RewatchButton({
  tmdbId,
  initialInRewatch,
  signedIn,
}: {
  tmdbId: number;
  initialInRewatch: boolean;
  signedIn: boolean;
}) {
  const { active: inRewatch, saving, toggle } = useToggleAction(
    initialInRewatch,
    `/api/movies/${tmdbId}/rewatch`,
    signedIn,
    ["Added to rewatch list", "Removed from rewatch list"]
  );

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={inRewatch}
      className={`flex items-center gap-1 text-xs transition-colors hover:underline disabled:opacity-50 ${
        inRewatch ? "text-accent-green" : "text-muted hover:text-accent-green"
      }`}
    >
      <RewatchIcon className="h-3.5 w-3.5" />
      {inRewatch ? "On rewatch list" : "Rewatch list"}
    </button>
  );
}
