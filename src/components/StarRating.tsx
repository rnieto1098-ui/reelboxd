"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAR_COUNT = 5;

export function StarRating({
  tmdbId,
  initialScore,
  signedIn,
}: {
  tmdbId: number;
  initialScore: number | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore ?? 0);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const displayScore = hoverScore ?? score;

  async function rate(newScore: number) {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    // Clicking the same rating again clears it.
    const nextScore = newScore === score ? 0 : newScore;
    setScore(nextScore);
    setSaving(true);

    if (nextScore === 0) {
      await fetch(`/api/movies/${tmdbId}/rating`, { method: "DELETE" });
    } else {
      await fetch(`/api/movies/${tmdbId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: nextScore }),
      });
    }

    setSaving(false);
    router.refresh();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>, star: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    const isHalf = e.clientX - rect.left < rect.width / 2;
    setHoverScore(star - (isHalf ? 0.5 : 0));
  }

  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHoverScore(null)}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => {
        const fill = Math.max(0, Math.min(1, displayScore - (star - 1)));
        return (
          <div
            key={star}
            className="relative h-7 w-7 cursor-pointer"
            onMouseMove={(e) => handleMouseMove(e, star)}
            onClick={() => rate(hoverScore ?? star)}
          >
            <StarOutline className="absolute inset-0 text-muted" />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <StarFilled className="h-7 w-7 text-accent-green" />
            </div>
          </div>
        );
      })}
      {saving && <span className="ml-1 text-xs text-muted">saving...</span>}
    </div>
  );
}

function StarOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.7l7.1-.6L12 2.5z"
      />
    </svg>
  );
}

function StarFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.7l7.1-.6L12 2.5z" />
    </svg>
  );
}
