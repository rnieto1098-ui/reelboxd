"use client";

import { useId, useState } from "react";
import { signOut } from "next-auth/react";
import { Dialog } from "@/components/Dialog";

/**
 * "Delete my account", behind two deliberate steps: open the dialog, then
 * type the username and the password. It removes everything and can't be
 * undone, so it should be hard to do by accident and impossible to do from
 * an unattended signed-in browser without knowing the password.
 */
export function DeleteAccountForm({ username }: { username: string }) {
  const nameId = useId();
  const passwordId = useId();
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function close() {
    if (deleting) return;
    setOpen(false);
    setTypedName("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDeleting(true);

    let res: Response;
    try {
      res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setDeleting(false);
      setError("Couldn't reach the server. Nothing was deleted.");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setDeleting(false);
      setError(body?.error ?? "Something went wrong. Nothing was deleted.");
      return;
    }

    // The account is gone; clear the now-meaningless session and leave.
    await signOut({ callbackUrl: "/" });
  }

  const nameMatches = typedName.trim() === username;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-danger">
        Delete account
      </button>

      {open && (
        <Dialog title="Delete your account?" onClose={close} size="sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm leading-relaxed text-muted">
              This permanently deletes your ratings, diary, watchlist, lists, challenges and
              everything else on your account.{" "}
              <strong className="text-foreground">It can&apos;t be undone.</strong> If you might
              want your data later, export it first.
            </p>
            <div>
              <label htmlFor={nameId} className="field-label">
                Type your username, <span className="font-semibold text-foreground">{username}</span>,
                to confirm
              </label>
              <input
                id={nameId}
                type="text"
                autoComplete="off"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="field-label">
                Your password
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={close} disabled={deleting} className="btn btn-ghost">
                Keep my account
              </button>
              <button
                type="submit"
                disabled={deleting || !nameMatches || !password}
                className="btn bg-danger text-white hover:bg-red-500"
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
