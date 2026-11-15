"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AuthShell, FormMessage } from "@/components/auth/AuthShell";

const backToSignIn = (
  <Link href="/login" className="font-medium text-accent-green underline-offset-2 hover:underline">
    Back to sign in
  </Link>
);

export default function ForgotPasswordPage() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    setLoading(false);

    // A successful response always shows the same confirmation, whether or
    // not the email is registered (the API is deliberately generic too). But
    // a failure is a failure: this used to say "check your email" even when
    // the request was rate-limited or the server errored.
    if (!res.ok) {
      setError(
        res.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : "Something went wrong sending that. Try again in a moment."
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <AuthShell title="Check your email" footer={backToSignIn}>
        <p className="text-sm leading-relaxed text-muted">
          If an account exists for <span className="font-medium text-foreground">{email}</span>,
          a link to reset your password is on its way. It expires in 1 hour.
        </p>
        <p className="mt-3 text-sm text-muted">Nothing after a few minutes? Check your spam folder.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account's email and we'll send you a link to choose a new one."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={emailId} className="field-label">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        {error && <FormMessage>{error}</FormMessage>}
        <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
