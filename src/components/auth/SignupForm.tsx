"use client";

import { useId, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormMessage } from "@/components/auth/AuthShell";

export function SignupForm() {
  const router = useRouter();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
    } catch {
      setLoading(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    // The account exists now; sign straight in. If that step fails for any
    // reason the account is still there, so send them to sign in by hand.
    const result = await signIn("credentials", { email, password, redirect: false }).catch(
      () => null
    );
    if (!result || result.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor={usernameId} className="field-label">
          Username
        </label>
        <input
          id={usernameId}
          name="username"
          type="text"
          autoComplete="username"
          required
          autoFocus
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-describedby={`${usernameId}-hint`}
          className="input"
        />
        <p id={`${usernameId}-hint`} className="mt-1.5 text-xs text-subtle">
          3 to 20 letters, numbers or underscores. This is your public profile name.
        </p>
      </div>
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="field-label">
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={`${passwordId}-hint`}
          className="input"
        />
        <p id={`${passwordId}-hint`} className="mt-1.5 text-xs text-subtle">
          At least 8 characters.
        </p>
      </div>
      {error && <FormMessage>{error}</FormMessage>}
      <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
        {loading ? "Creating your account…" : "Create account"}
      </button>
      <p className="text-xs leading-relaxed text-subtle">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="text-muted underline underline-offset-2 hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="text-muted underline underline-offset-2 hover:text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}
