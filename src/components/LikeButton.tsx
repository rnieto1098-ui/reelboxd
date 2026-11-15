"use client";

import { Heart } from "lucide-react";
import { useToggleAction } from "@/lib/useToggleAction";

export function LikeButton({
  tmdbId,
  initialLiked,
  likeCount,
  signedIn,
}: {
  tmdbId: number;
  initialLiked: boolean;
  likeCount: number;
  signedIn: boolean;
}) {
  const { active: liked, saving, toggle } = useToggleAction(
    initialLiked,
    `/api/movies/${tmdbId}/like`,
    signedIn,
    ["Liked", "Unliked"]
  );

  // `likeCount` is what the server last counted, including this viewer's own
  // like as of then. Shifting it by the difference between then and now
  // moves the number the moment the heart is pressed instead of a second
  // later when the page refreshes.
  const shown = Math.max(0, likeCount + (liked ? 1 : 0) - (initialLiked ? 1 : 0));

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      title={liked ? "Unlike" : "Like"}
      className={`btn ${liked ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "btn-secondary"}`}
    >
      <Heart
        aria-hidden
        // Keyed on the state so the little pop replays on each press.
        key={String(liked)}
        className={`h-4 w-4 ${liked ? "animate-pop fill-current" : ""}`}
      />
      {shown > 0 ? shown : "Like"}
    </button>
  );
}
