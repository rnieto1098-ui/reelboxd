"use client";

import { useEffect, useId, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormMessage } from "@/components/auth/AuthShell";
import { readRememberedEmail, rememberEmail } from "@/lib/rememberedEmail";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // This device's last account, filled in so signing back in is just the password.
  useEffect(() => {
    const saved = readRememberedEmail();
    if (saved) {
      setEmail((current) => current || saved);
      passwordRef.current?.focus();
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let result: Awaited<ReturnType<typeof signIn>>;
    try {
      result = await signIn("credentials", { email, password, redirect: false });
    } catch {
      // A dropped connection used to reject here with nothing catching it,
      // leaving the button stuck on "Signing in…" until a reload.
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (result?.error) {
      setLoading(false);
      setError("That email and password don't match an account.");
      return;
    }

    rememberEmail(email);
    // Left in the loading state on purpose: the page is about to change.
    router.push(next);
    router.refresh();
  }

  return (
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
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor={passwordId} className="field-label">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted underline-offset-2 hover:text-accent-green hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          ref={passwordRef}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>
      {error && <FormMessage>{error}</FormMessage>}
      <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
