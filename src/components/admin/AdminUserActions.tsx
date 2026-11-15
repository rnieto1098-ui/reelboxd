"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Dialog } from "@/components/Dialog";

/**
 * The per-user actions in the admin Users table: grant or remove admin
 * rights, and delete the account. Deleting asks for the username to be
 * typed, since it removes everything that person has logged and can't be
 * undone. The server enforces the real rules (never the last admin, never
 * your own account from here); this only makes them hard to trip over.
 */
export function AdminUserActions({
  userId,
  username,
  isAdmin,
  isSelf,
}: {
  userId: string;
  username: string;
  isAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const confirmId = useId();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typed, setTyped] = useState("");

  async function request(method: "PATCH" | "DELETE", body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        showToast(data?.error ?? "That didn't work. Try again.", "error");
        return false;
      }
      return true;
    } catch {
      showToast("Couldn't reach the server. Try again.", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin() {
    if (await request("PATCH", { role: isAdmin ? "USER" : "ADMIN" })) {
      showToast(isAdmin ? `${username} is no longer an admin` : `${username} is now an admin`);
      router.refresh();
    }
  }

  async function deleteUser(e: React.FormEvent) {
    e.preventDefault();
    if (await request("DELETE")) {
      setConfirmingDelete(false);
      showToast(`Deleted ${username}'s account`);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={toggleAdmin}
        disabled={busy}
        className="btn btn-ghost btn-sm"
        title={isAdmin ? "Remove admin rights" : "Give admin rights"}
      >
        {isAdmin ? (
          <ShieldOff aria-hidden className="h-4 w-4" />
        ) : (
          <ShieldCheck aria-hidden className="h-4 w-4" />
        )}
        <span className="hidden xl:inline">{isAdmin ? "Remove admin" : "Make admin"}</span>
        <span className="sr-only xl:hidden">
          {isAdmin ? `Remove admin rights from ${username}` : `Make ${username} an admin`}
        </span>
      </button>
      {!isSelf && (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          aria-label={`Delete ${username}'s account`}
          title="Delete account"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
      )}

      {confirmingDelete && (
        <Dialog
          title={`Delete ${username}?`}
          onClose={() => {
            if (!busy) {
              setConfirmingDelete(false);
              setTyped("");
            }
          }}
          size="sm"
        >
          <form onSubmit={deleteUser} className="space-y-4">
            <p className="text-sm leading-relaxed text-muted">
              This permanently deletes the account and everything on it: ratings, diary,
              watchlist, lists and challenges.{" "}
              <strong className="text-foreground">It can&apos;t be undone.</strong>
            </p>
            <div>
              <label htmlFor={confirmId} className="field-label">
                Type <span className="font-semibold text-foreground">{username}</span> to confirm
              </label>
              <input
                id={confirmId}
                type="text"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setTyped("");
                }}
                disabled={busy}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || typed.trim() !== username}
                className="btn bg-danger text-white hover:bg-red-500"
              >
                {busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
