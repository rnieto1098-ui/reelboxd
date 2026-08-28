"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared logic behind every per-user-per-movie toggle button (watchlist,
 * like, owned): optimistic local state, a signed-out redirect, and a
 * POST/DELETE against `url` depending on the current state.
 *
 * `initialActive` can change out from under the caller after a
 * `router.refresh()` triggered by a *different* component on the page (e.g.
 * rating a movie auto-removes it from the watchlist server-side) — the
 * `useEffect` re-sync exists because `useState`'s initial value only applies
 * on mount.
 */
export function useToggleAction(initialActive: boolean, url: string, signedIn: boolean) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActive(initialActive);
  }, [initialActive]);

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setSaving(true);
    const method = active ? "DELETE" : "POST";
    await fetch(url, { method });
    setActive(!active);
    setSaving(false);
    router.refresh();
  }

  return { active, saving, toggle };
}
