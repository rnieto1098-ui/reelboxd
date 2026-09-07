"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// How long after a refresh to keep absorbing further ones. Ticking off a row
// of posters lands well inside this; two deliberate clicks a beat apart
// don't, and each gets its own immediate refresh.
const COOLDOWN_MS = 1000;

// Deliberately module-level, not per-component: the bursts worth collapsing
// are usually spread *across* instances — ticking off six posters in a row
// is six different PosterQuickActions, each of which would otherwise
// schedule its own full route refresh.
let lastRefreshAt = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRouter: { refresh: () => void } | null = null;
let pendingLocation: string | null = null;

function currentLocation(): string {
  return window.location.pathname + window.location.search;
}

function runTrailing() {
  trailingTimer = null;
  lastRefreshAt = Date.now();
  // Navigating away already fetched the new route's server components, so a
  // refresh scheduled against the old one is pure waste at best.
  if (currentLocation() !== pendingLocation) return;
  pendingRouter?.refresh();
}

/**
 * `router.refresh()` for the frequently-clicked toggles, throttled.
 *
 * These toggles paint their own state optimistically, so the refresh has
 * nothing to do with how fast the button responds. What it's still for is
 * everything *else* on the page that derives from the same data, which the
 * clicked control can't update on its own: rating a film, marking it
 * watched, or logging it all drop it from the watchlist server-side, so a
 * different button has to notice; likes carry a server-rendered count;
 * lists and challenges carry watched-percent badges and progress bars.
 *
 * That makes it load-bearing and not safe to simply drop — but it doesn't
 * have to run once per click. This fires on the leading edge, so a single
 * click still syncs immediately, then absorbs anything that follows within
 * the cooldown into one trailing refresh. A burst of N costs two route
 * re-renders instead of N, and nothing ends up stale either way.
 *
 * Leading-edge rather than a plain debounce on purpose: each caller only
 * gets here *after* its own request resolves, so the calls in a burst
 * arrive spaced by network latency, not by how fast the user clicked. A
 * trailing-only window has to be longer than that spacing to catch
 * anything — which measured at 5 refreshes for 6 rapid clicks — and
 * lengthening it would delay the single-click case for no reason.
 */
export function useCoalescedRefresh(): () => void {
  const router = useRouter();

  return useCallback(() => {
    pendingRouter = router;
    pendingLocation = currentLocation();

    const now = Date.now();
    const sinceLast = now - lastRefreshAt;

    if (sinceLast >= COOLDOWN_MS) {
      lastRefreshAt = now;
      router.refresh();
      return;
    }

    // Inside the cooldown: fold this into the single trailing refresh.
    if (trailingTimer) clearTimeout(trailingTimer);
    trailingTimer = setTimeout(runTrailing, COOLDOWN_MS - sinceLast);
  }, [router]);
}
