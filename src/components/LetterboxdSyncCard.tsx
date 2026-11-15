"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

// A profile visit auto-syncs at most this often — keeps a Letterboxd log
// showing up in Flixtally without a click most of the time, without hammering
// Letterboxd's RSS feed on every page load. The daily Vercel cron (see
// vercel.json) is the backstop for accounts that never revisit their profile.
const AUTO_SYNC_STALE_MS = 30 * 60 * 1000;

type SyncSummary = {
  imported: number;
  ratingsImported?: number;
  likesImported?: number;
  completedChallenges?: { id: string; title: string }[];
  completedGoal?: { year: number; target: number } | null;
  watchlistAdded?: number;
  watchlistSkippedWatched?: number;
  watchlistError?: string | null;
};

function hasNewData(body: SyncSummary) {
  return (
    body.imported > 0 ||
    (body.watchlistAdded ?? 0) > 0 ||
    // Skipping films you've already watched is a real outcome, not nothing
    // happening — without this a sync of a watchlist you've since watched
    // reports "already up to date" and never explains itself.
    (body.watchlistSkippedWatched ?? 0) > 0
  );
}

function summaryMessage(body: SyncSummary) {
  if (!hasNewData(body)) return "Already up to date — nothing new on Letterboxd.";
  const parts = [];
  if (body.imported > 0) parts.push(`${body.imported} diary ${body.imported === 1 ? "entry" : "entries"}`);
  if (body.ratingsImported) parts.push(`${body.ratingsImported} rating${body.ratingsImported === 1 ? "" : "s"}`);
  if (body.likesImported) parts.push(`${body.likesImported} like${body.likesImported === 1 ? "" : "s"}`);
  if (body.watchlistAdded) {
    parts.push(`${body.watchlistAdded} watchlist item${body.watchlistAdded === 1 ? "" : "s"}`);
  }

  const skipped = body.watchlistSkippedWatched ?? 0;
  const skippedNote =
    skipped > 0 ? ` (skipped ${skipped} watchlist film${skipped === 1 ? "" : "s"} you've already watched)` : "";

  // Everything the sync found was a film already watched here, so there's
  // nothing to list — saying "Synced  from Letterboxd" would be worse than
  // saying what actually happened.
  if (parts.length === 0) {
    return `Nothing new to add — skipped ${skipped} watchlist film${
      skipped === 1 ? "" : "s"
    } you've already watched.`;
  }

  return `Synced ${parts.join(", ")} from Letterboxd${skippedNote}`;
}

export function LetterboxdSyncCard({
  initialUsername,
  initialSyncedAt,
}: {
  initialUsername: string | null;
  initialSyncedAt: string | null;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldId = useId();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  // The "last synced" time is shown in the viewer's own timezone, which the
  // server doesn't know. Formatting it during the first render produced one
  // time on the server and another in the browser (a hydration mismatch), so
  // it is filled in after the page has loaded instead.
  const [syncedLabel, setSyncedLabel] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- needs the browser's timezone
    setSyncedLabel(
      initialSyncedAt
        ? new Date(initialSyncedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null
    );
  }, [initialSyncedAt]);

  function announce(body: SyncSummary) {
    showToast(summaryMessage(body));
    for (const challenge of body.completedChallenges ?? []) {
      showToast(`Challenge complete: ${challenge.title}`, "celebrate");
    }
    if (body.completedGoal) {
      showToast(`${body.completedGoal.year} watch goal complete!`, "celebrate");
    }
    if (body.watchlistError) {
      showToast(`Watchlist sync: ${body.watchlistError}`, "error");
    }
  }

  useEffect(() => {
    if (!initialUsername) return;
    const lastSynced = initialSyncedAt ? new Date(initialSyncedAt).getTime() : 0;
    if (Date.now() - lastSynced < AUTO_SYNC_STALE_MS) return;

    fetch("/api/account/letterboxd/sync", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: SyncSummary | null) => {
        if (!body || !hasNewData(body)) return;
        announce(body);
        router.refresh();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the connected account changes
  }, [initialUsername]);

  // Every request below is wrapped the same way: a dropped connection, or a
  // sync that outlives the server's time limit and comes back as an error
  // page rather than JSON, used to throw past `setBusy(false)` and leave the
  // card stuck on "Working…" until the page was reloaded.
  async function call(
    url: string,
    init: RequestInit,
    fallbackError: string
  ): Promise<SyncSummary & { username?: string } | null> {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(body?.error ?? fallbackError, "error");
        return null;
      }
      return body ?? { imported: 0 };
    } catch {
      showToast(fallbackError, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    const body = await call(
      "/api/account/letterboxd",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      },
      "Couldn't connect that account. Check the username and try again."
    );
    if (!body) return;
    showToast(`Connected to letterboxd.com/${body.username}`);
    announce(body);
    router.refresh();
  }

  async function syncNow() {
    const body = await call(
      "/api/account/letterboxd/sync",
      { method: "POST" },
      "The sync didn't finish. Try again in a minute."
    );
    if (!body) return;
    announce(body);
    router.refresh();
  }

  async function disconnect() {
    // Only reported as done when it is: this used to say "Disconnected"
    // without looking at the response.
    const body = await call(
      "/api/account/letterboxd",
      { method: "DELETE" },
      "Couldn't disconnect. Try again."
    );
    if (!body) return;
    setConfirmingDisconnect(false);
    showToast("Disconnected from Letterboxd");
    router.refresh();
  }

  if (!initialUsername) {
    return (
      <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor={fieldId} className="field-label">
            Your Letterboxd username
          </label>
          <input
            id={fieldId}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. davidehrlich"
            autoComplete="off"
            className="input"
          />
        </div>
        <button type="submit" disabled={busy || !username.trim()} className="btn btn-primary">
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="min-w-0 flex-1 text-muted">
        Synced with{" "}
        <a
          href={`https://letterboxd.com/${initialUsername}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-green underline-offset-2 hover:underline"
        >
          letterboxd.com/{initialUsername}
        </a>
        {syncedLabel && ` · last synced ${syncedLabel}`}
      </span>
      {confirmingDisconnect ? (
        <span className="flex items-center gap-2">
          <button type="button" onClick={disconnect} disabled={busy} className="btn btn-danger btn-sm">
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDisconnect(false)}
            className="btn btn-ghost btn-sm"
          >
            Keep
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <button type="button" onClick={syncNow} disabled={busy} className="btn btn-secondary btn-sm">
            {busy ? "Working…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDisconnect(true)}
            disabled={busy}
            className="btn btn-ghost btn-sm"
          >
            Disconnect
          </button>
        </span>
      )}
    </div>
  );
}
