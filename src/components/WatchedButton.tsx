"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { EyeIcon } from "@/components/icons";
import { useCoalescedRefresh } from "@/lib/useCoalescedRefresh";

// Why a film can still count as watched after its mark is removed — the
// route reports this so the button never claims something the data doesn't.
const STILL_WATCHED_MESSAGE: Record<string, string> = {
  diary: "Still watched — it's logged in your diary.",
  rating: "Still watched — you've rated it.",
};

/**
 * "I've seen this" with no date attached — the counterpart to Log watch,
 * which always writes a dated diary entry. For films watched long enough
 * ago that inventing a date would put a wrong entry in the diary and skew
 * every dated stat.
 *
 * Lit whenever the film counts as watched at all, including via a diary
 * entry or rating, so it never contradicts the rest of the page. The click
 * flips it immediately for a responsive feel, then reconciles against the
 * response rather than trusting the flip outright: removing the mark from a
 * film that's also logged leaves it watched, and only the server knows
 * that, so a successful DELETE can still land back on `true`. A failed
 * request reverts to whatever the button showed before the click.
 */
export function WatchedButton({
  tmdbId,
  initialWatched,
  signedIn,
}: {
  tmdbId: number;
  initialWatched: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const refresh = useCoalescedRefresh();
  const showToast = useToast();
  const [watched, setWatched] = useState(initialWatched);
  const [saving, setSaving] = useState(false);

  const [prevInitial, setPrevInitial] = useState(initialWatched);
  if (initialWatched !== prevInitial && !saving) {
    setPrevInitial(initialWatched);
    setWatched(initialWatched);
  }

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }

    const previousWatched = watched;
    setWatched(!previousWatched);
    setSaving(true);

    let res: Response;
    try {
      res = await fetch(`/api/movies/${tmdbId}/watched`, {
        method: previousWatched ? "DELETE" : "POST",
      });
    } catch {
      setSaving(false);
      setWatched(previousWatched);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    if (res.status === 401) {
      setSaving(false);
      setWatched(previousWatched);
      router.push("/login");
      return;
    }
    if (!res.ok) {
      setSaving(false);
      setWatched(previousWatched);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    // Parsed before clearing `saving` — the response is what decides the
    // final state, so re-enabling the button first would expose an
    // unreconciled value to a second click.
    const body = await res.json().catch(() => null);
    setSaving(false);
    // Reconciled against the server's answer, not assumed from the optimistic
    // flip — see the component doc comment for why a DELETE can still land
    // back on `true`.
    setWatched(body?.watched ?? !previousWatched);
    refresh();

    if (!previousWatched) {
      showToast("Marked as watched");
      for (const challenge of body?.completedChallenges ?? []) {
        showToast(`🎉 Challenge complete: ${challenge.title}`);
      }
    } else {
      showToast(
        STILL_WATCHED_MESSAGE[body?.stillWatchedBecause] ?? "No longer marked watched"
      );
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={
        watched
          ? "Marked watched — click to undo"
          : "Mark as watched, without picking a date"
      }
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        watched
          ? "border-accent-green bg-accent-green/10 text-accent-green"
          : "border-border text-muted hover:text-foreground"
      }`}
    >
      <EyeIcon />
      Watched
    </button>
  );
}
