"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

function summaryMessage(body: { imported: number; ratingsImported?: number; likesImported?: number }) {
  if (body.imported === 0) return "Already up to date — nothing new on Letterboxd.";
  const parts = [`${body.imported} diary ${body.imported === 1 ? "entry" : "entries"}`];
  if (body.ratingsImported) parts.push(`${body.ratingsImported} rating${body.ratingsImported === 1 ? "" : "s"}`);
  if (body.likesImported) parts.push(`${body.likesImported} like${body.likesImported === 1 ? "" : "s"}`);
  return `Synced ${parts.join(", ")} from Letterboxd`;
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

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    const res = await fetch("/api/account/letterboxd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() }),
    });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      showToast(body.error ?? "Couldn't connect that account", "error");
      return;
    }

    showToast(`Connected to letterboxd.com/${body.username} — ${summaryMessage(body)}`);
    router.refresh();
  }

  async function syncNow() {
    setBusy(true);
    const res = await fetch("/api/account/letterboxd/sync", { method: "POST" });
    const body = await res.json();
    setBusy(false);

    if (!res.ok) {
      showToast(body.error ?? "Sync failed", "error");
      return;
    }

    showToast(summaryMessage(body));
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/account/letterboxd", { method: "DELETE" });
    setBusy(false);
    showToast("Disconnected from Letterboxd");
    router.refresh();
  }

  if (!initialUsername) {
    return (
      <form onSubmit={connect} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Sync diary from Letterboxd</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Letterboxd username"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-accent-green"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !username.trim()}
          className="rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Connecting..." : "Connect"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">
        Synced with{" "}
        <a
          href={`https://letterboxd.com/${initialUsername}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-green hover:underline"
        >
          letterboxd.com/{initialUsername}
        </a>
        {initialSyncedAt &&
          ` · last synced ${new Date(initialSyncedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`}
      </span>
      <button
        type="button"
        onClick={syncNow}
        disabled={busy}
        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent-green transition-colors disabled:opacity-50"
      >
        {busy ? "Working..." : "Sync now"}
      </button>
      <button
        type="button"
        onClick={disconnect}
        disabled={busy}
        className="text-xs text-muted hover:text-red-400 disabled:opacity-50"
      >
        Disconnect
      </button>
    </div>
  );
}
