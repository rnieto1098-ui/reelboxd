"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Always shows the same confirmation, whether or not the email is
    // registered — the API response is deliberately generic too, so there's
    // nothing more specific to show here.
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for <span className="text-foreground">{email}</span>, we&apos;ve sent
          a link to reset your password. It expires in 1 hour.
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link href="/login" className="text-accent-green hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Reset your password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent-green px-3 py-2 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="text-accent-green hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
