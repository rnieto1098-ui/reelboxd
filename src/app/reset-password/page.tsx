"use client";

import { Suspense, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell, FormMessage } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary around it, or Next opts the
  // whole route into client-only rendering at build time.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const passwordId = useId();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell title="This link won't work">
        <p className="text-sm leading-relaxed text-muted">
          The password reset link is incomplete. It may have been cut off when it was copied.
        </p>
        <Link href="/forgot-password" className="btn btn-primary mt-5">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <AuthShell title="Password updated">
        <FormMessage kind="success">Your new password is saved.</FormMessage>
        <p className="mt-4 text-sm text-muted">
          Taking you to sign in…{" "}
          <Link
            href="/login"
            className="font-medium text-accent-green underline-offset-2 hover:underline"
          >
            or go now
          </Link>
          .
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={passwordId} className="field-label">
            New password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <p className="mt-1.5 text-xs text-subtle">At least 8 characters.</p>
        </div>
        {error && <FormMessage>{error}</FormMessage>}
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
