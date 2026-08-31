"use client";

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

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={liked}
      title={liked ? "Unlike" : "Like"}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 transition-colors ${liked ? "text-red-500" : "text-muted"}`}
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 20.5s-7.5-4.7-10-9.3C.5 7.8 2.3 4.5 5.8 4c2.2-.3 4.3.9 6.2 3 1.9-2.1 4-3.3 6.2-3 3.5.5 5.3 3.8 3.8 7.2-2.5 4.6-10 9.3-10 9.3Z"
        />
      </svg>
      {likeCount > 0 && <span>{likeCount}</span>}
    </button>
  );
}
