"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";
import { localDateString } from "@/lib/dates";

const STAR_COUNT = 5;

/**
 * Half-star rating. Works three ways:
 *  - mouse: hover previews, click sets (left half of a star = half star)
 *  - touch: tap sets, using where on the star the tap landed
 *  - keyboard: it is one tab stop that behaves like a slider. Left/Right
 *    change the rating by half a star, 1-5 jump to a whole number, and
 *    0, Backspace or Delete clear it.
 * Clicking the rating you already have clears it.
 */
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
  const refresh = useCoalescedRefresh();
  const showToast = useToast();
  const [score, setScore] = useState(initialScore ?? 0);
  const [hoverScore, setHoverScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // The rating can change from elsewhere on the page (a refresh after an
  // import, another tab). Adjusted during render, not in an effect, so a
  // stale value never paints; skipped mid-save so it can't undo a click.
  const [prevInitial, setPrevInitial] = useState(initialScore);
  if (initialScore !== prevInitial && !saving) {
    setPrevInitial(initialScore);
    setScore(initialScore ?? 0);
  }

  const displayScore = hoverScore ?? score;

  async function rate(newScore: number, toggleOff = true) {
    // A touch tap leaves a synthetic hover behind; without clearing it the
    // stars kept showing the previewed value after a clear or a failed save.
    setHoverScore(null);
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    // Ignore clicks while a rating is in flight. Without this, rating 3 then
    // 5 quickly sends two overlapping requests that can commit out of order,
    // and the second click's rollback value would be the first click's
    // unconfirmed score — a value the server never held.
    if (saving) return;

    const clamped = Math.max(0, Math.min(STAR_COUNT, newScore));
    // Clicking the same rating again clears it.
    const nextScore = toggleOff && clamped === score ? 0 : clamped;
    if (nextScore === score) return;
    const previousScore = score;
    setScore(nextScore);
    setSaving(true);

    let res: Response;
    try {
      res =
        nextScore === 0
          ? await fetch(`/api/movies/${tmdbId}/rating`, { method: "DELETE" })
          : await fetch(`/api/movies/${tmdbId}/rating`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // The viewer's own calendar date, for the diary entry a first
              // rating creates. The server only knows the UTC date, which is
              // already tomorrow for an evening viewer in the Americas.
              body: JSON.stringify({ score: nextScore, date: localDateString() }),
            });
    } catch {
      // Without this the rejection escaped the function entirely: `saving`
      // stayed true so "saving..." was pinned on screen for good, and the
      // stars kept showing a rating that was never persisted.
      setSaving(false);
      setScore(previousScore);
      showToast("Couldn't save that rating — try again.", "error");
      return;
    }

    if (!res.ok) {
      setSaving(false);
      setScore(previousScore);
      showToast("Couldn't save that rating — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    const stars = `${nextScore} star${nextScore === 1 ? "" : "s"}`;
    showToast(
      nextScore === 0
        ? "Rating removed"
        : body?.loggedToday
          ? `Rated ${stars} and logged in your diary`
          : `Rated ${stars}`
    );
    for (const challenge of body?.completedChallenges ?? []) {
      showToast(`Challenge complete: ${challenge.title}`);
    }
    if (body?.completedGoal) showToast(`${body.completedGoal.year} watch goal complete!`);
    refresh();
  }

  function scoreFromPointer(e: React.MouseEvent<HTMLElement>, star: number) {
    const rect = e.currentTarget.getBoundingClientRect();
    return star - (e.clientX - rect.left < rect.width / 2 ? 0.5 : 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = score + 0.5;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = score - 0.5;
    else if (e.key === "Home" || e.key === "0" || e.key === "Backspace" || e.key === "Delete") next = 0;
    else if (e.key === "End") next = STAR_COUNT;
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key);
    if (next == null) return;
    e.preventDefault();
    rate(next, false);
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Your rating"
        aria-valuemin={0}
        aria-valuemax={STAR_COUNT}
        aria-valuenow={score}
        aria-valuetext={score === 0 ? "Not rated" : `${score} out of ${STAR_COUNT} stars`}
        aria-busy={saving}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHoverScore(null)}
        className="inline-flex items-center rounded-md"
      >
        {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => {
          const fill = Math.max(0, Math.min(1, displayScore - (star - 1)));
          return (
            <span
              key={star}
              className="relative block h-9 w-9 cursor-pointer p-0.5 transition-transform duration-150 hover:scale-110 active:scale-95"
              // Hover preview is for mice only: a finger has no hover, and
              // the event a tap synthesises used to stick.
              onPointerMove={(e) => {
                if (e.pointerType === "mouse") setHoverScore(scoreFromPointer(e, star));
              }}
              onClick={(e) => rate(scoreFromPointer(e, star))}
            >
              <StarOutline className="absolute inset-0.5 text-white/30" />
              <span
                className="absolute inset-y-0.5 left-0.5 overflow-hidden"
                style={{ width: `calc((100% - 0.25rem) * ${fill})` }}
              >
                <StarFilled className="h-8 w-8 text-accent-gold" />
              </span>
            </span>
          );
        })}
      </div>
      <span className="min-w-[4.5rem] text-sm text-muted" aria-live="polite">
        {saving ? "Saving…" : displayScore > 0 ? `${displayScore.toFixed(1)} / 5` : "Rate it"}
      </span>
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
