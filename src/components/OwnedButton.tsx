"use client";

import { useToggleAction } from "@/lib/useToggleAction";
import { DiscIcon } from "@/components/icons";

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
    signedIn
  );

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        owned
          ? "border-accent-green bg-accent-green/10 text-accent-green"
          : "border-border text-muted hover:text-foreground"
      }`}
    >
      <DiscIcon />
      Owned
    </button>
  );
}
