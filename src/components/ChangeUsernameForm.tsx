"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function ChangeUsernameForm({ currentUsername }: { currentUsername: string }) {
  const router = useRouter();
  const showToast = useToast();
  const fieldId = useId();
  const [username, setUsername] = useState(currentUsername);
  const [saving, setSaving] = useState(false);

  // Follow the saved name once it changes (after the refresh below).
  const [prevCurrent, setPrevCurrent] = useState(currentUsername);
  if (currentUsername !== prevCurrent) {
    setPrevCurrent(currentUsername);
    setUsername(currentUsername);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username === currentUsername) return;
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/account/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    } catch {
      setSaving(false);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(data?.error ?? "Something went wrong", "error");
      return;
    }

    // The session picks the new name up on the next request (see the jwt
    // callback in auth.ts), so a refresh is all it takes. This used to sign
    // the user out to get a new session, with no warning beforehand.
    showToast(`Username changed to ${username}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor={fieldId} className="field-label">
            Username
          </label>
          <input
            id={fieldId}
            name="username"
            type="text"
            autoComplete="username"
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby={`${fieldId}-hint`}
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={saving || username === currentUsername || username.length < 3}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Save username"}
        </button>
      </div>
      <p id={`${fieldId}-hint`} className="mt-2 text-xs text-subtle">
        3 to 20 letters, numbers or underscores. Your profile address changes with it, so links
        to your current profile page will stop working.
      </p>
    </form>
  );
}
