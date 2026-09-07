"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Shared logic behind every per-user-per-movie toggle button (watchlist,
 * like, owned): optimistic local state, a signed-out redirect, and a
 * POST/DELETE against `url` depending on the current state.
 *
 * The click flips `active` immediately rather than waiting for the
 * response — a toggle button that visibly lags behind its own click reads
 * as broken. The flip is only ever wrong for the rare failed request (a
 * stale session, a transient 500, a dropped connection), and that's
 * handled explicitly: on failure `active` is set back to exactly what it
 * was before this click (captured in `previousActive`, not re-derived),
 * and an error toast explains it reverted. This is deliberately not the
 * same bug this app shipped once before — that version flipped
 * optimistically too, but never checked the response and so never rolled
 * back a failure at all, leaving the wrong state on screen indefinitely.
 *
 * `initialActive` can change out from under the caller after a
 * `router.refresh()` triggered by a *different* component on the page (e.g.
 * rating a movie auto-removes it from the watchlist server-side) — `active`
 * is reset in response, during render (React's documented pattern for
 * "adjusting state when a prop changes"), rather than in a `useEffect`, so
 * the stale value never paints even for a single frame. Guarded by
 * `saving` so it can't clobber a click's own optimistic flip while that
 * click's request is still in flight.
 *
 * `toastLabels`, if given, is [message when turning on, message when
 * turning off] — shown via the shared toast system on a successful toggle.
 */
export function useToggleAction(
  initialActive: boolean,
  url: string,
  signedIn: boolean,
  toastLabels?: [onLabel: string, offLabel: string]
) {
  const router = useRouter();
  const showToast = useToast();
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  const [prevInitialActive, setPrevInitialActive] = useState(initialActive);
  if (initialActive !== prevInitialActive && !saving) {
    setPrevInitialActive(initialActive);
    setActive(initialActive);
  }

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }

    const previousActive = active;
    const nextActive = !previousActive;
    setActive(nextActive);
    setSaving(true);

    let res: Response;
    try {
      res = await fetch(url, { method: previousActive ? "DELETE" : "POST" });
    } catch {
      setSaving(false);
      setActive(previousActive);
      showToast("Something went wrong — try again.", "error");
      return;
    }
    setSaving(false);

    if (res.status === 401) {
      setActive(previousActive);
      router.push("/login");
      return;
    }
    if (!res.ok) {
      setActive(previousActive);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    if (toastLabels) showToast(nextActive ? toastLabels[0] : toastLabels[1]);
    router.refresh();
  }

  return { active, saving, toggle };
}
