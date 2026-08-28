"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function ChangeUsernameForm({ currentUsername }: { currentUsername: string }) {
  const [username, setUsername] = useState(currentUsername);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username === currentUsername) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/account/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setSaving(false);
      return;
    }

    // The signed-in username is baked into the JWT session at login time,
    // so it won't reflect the change until the session is reissued.
    setDone(true);
    setTimeout(() => signOut({ callbackUrl: "/login" }), 1500);
  }

  if (done) {
    return (
      <p className="text-sm text-accent-green">
        Username updated — signing you out so you can log back in with it.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving || username === currentUsername}
        className="rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save username"}
      </button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </form>
  );
}
