"use client";

import { useId, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const showToast = useToast();
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("The new password needs at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two new passwords don't match.");
      return;
    }

    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      setSaving(false);
      setError("Couldn't reach the server. Your password wasn't changed.");
      return;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      setSaving(false);
      setError(data?.error ?? "Something went wrong. Your password wasn't changed.");
      return;
    }

    // Changing the password ends every session on the account, this one
    // included, so sign straight back in here with the new one. If that
    // doesn't work for any reason, the sign-in page is the fallback.
    const result = await signIn("credentials", {
      email,
      password: newPassword,
      redirect: false,
    }).catch(() => null);
    setSaving(false);

    if (!result || result.error) {
      router.push("/login");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    showToast("Password changed. Your other devices have been signed out.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="sm:max-w-xs">
        <label htmlFor={currentId} className="field-label">
          Current password
        </label>
        <input
          id={currentId}
          name="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={newId} className="field-label">
            New password
          </label>
          <input
            id={newId}
            name="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={confirmId} className="field-label">
            New password again
          </label>
          <input
            id={confirmId}
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="btn btn-primary"
        >
          {saving ? "Saving…" : "Change password"}
        </button>
        <p className="mt-2 text-xs text-subtle">
          At least 8 characters. Changing it signs you out on every other device.
        </p>
      </div>
    </form>
  );
}
