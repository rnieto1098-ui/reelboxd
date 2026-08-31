"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

/**
 * Shared logic behind every per-user-per-movie toggle button (watchlist,
 * like, owned): optimistic local state, a signed-out redirect, and a
 * POST/DELETE against `url` depending on the current state.
 *
 * `initialActive` can change out from under the caller after a
 * `router.refresh()` triggered by a *different* component on the page (e.g.
 * rating a movie auto-removes it from the watchlist server-side) — `active`
 * is reset in response, during render (React's documented pattern for
 * "adjusting state when a prop changes"), rather than in a `useEffect`, so
 * the stale value never paints even for a single frame.
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
  if (initialActive !== prevInitialActive) {
    setPrevInitialActive(initialActive);
    setActive(initialActive);
  }

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setSaving(true);
    const method = active ? "DELETE" : "POST";
    const res = await fetch(url, { method });
    setSaving(false);

    if (res.status === 401) {
      router.push("/login");
      return;
    }
    // Previously toggled optimistically regardless of the response — a
    // failed request (a stale session, a transient 500) would still show
    // the wrong state until the next refresh. Only commit the flip once
    // the server has actually confirmed it.
    if (!res.ok) {
      showToast("Something went wrong — try again.", "error");
      return;
    }

    const nextActive = !active;
    setActive(nextActive);
    if (toastLabels) showToast(nextActive ? toastLabels[0] : toastLabels[1]);
    router.refresh();
  }

  return { active, saving, toggle };
}
