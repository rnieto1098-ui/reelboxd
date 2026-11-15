"use client";

import { useToggleAction } from "@/lib/useToggleAction";
import { ShoppingBagIcon } from "@/components/icons";

export function OwnedButton({
  tmdbId,
  initialOwned,
  signedIn,
}: {
  tmdbId: number;
  initialOwned: boolean;
  signedIn: boolean;
}) {
  const { active: owned, saving, toggle } = useToggleAction(
    initialOwned,
    `/api/movies/${tmdbId}/owned`,
    signedIn,
    ["Marked as owned", "Removed from owned"]
  );

  return (
    <button
      onClick={toggle}
      disabled={saving}
      type="button"
      aria-pressed={owned}
      className={`btn ${owned ? "btn-active" : "btn-secondary"}`}
    >
      <ShoppingBagIcon />
      Owned
    </button>
  );
}
