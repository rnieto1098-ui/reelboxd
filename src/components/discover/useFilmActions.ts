"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { loginHref } from "@/lib/loginHref";
import { useToast } from "@/components/Toast";

type Method = "POST" | "DELETE";

/**
 * The calls behind Discover's card and spotlight buttons. Each returns
 * whether it worked, so the caller can roll back an optimistic change; a
 * signed-out session goes to the login page instead.
 */
export function useFilmActions() {
  const router = useRouter();
  const showToast = useToast();

  const send = useCallback(
    async (tmdbId: number, action: "watchlist" | "watched" | "dismiss", method: Method) => {
      let res: Response;
      try {
        res = await fetch(`/api/movies/${tmdbId}/${action}`, { method });
      } catch {
        showToast("Something went wrong — try again.", "error");
        return false;
      }
      if (res.status === 401) {
        router.push(loginHref());
        return false;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(body?.error ?? "Something went wrong — try again.", "error");
        return false;
      }
      return true;
    },
    [router, showToast]
  );

  return {
    setWatchlist: (tmdbId: number, on: boolean) => send(tmdbId, "watchlist", on ? "POST" : "DELETE"),
    markSeen: (tmdbId: number) => send(tmdbId, "watched", "POST"),
    dismiss: (tmdbId: number) => send(tmdbId, "dismiss", "POST"),
    undismiss: (tmdbId: number) => send(tmdbId, "dismiss", "DELETE"),
    showToast,
  };
}
