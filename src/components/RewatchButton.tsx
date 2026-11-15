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
      className={`btn ${inRewatch ? "btn-active" : "btn-secondary"}`}
    >
      <RewatchIcon />
      {inRewatch ? "On rewatch list" : "Rewatch"}
    </button>
  );
}
