"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches rendering/runtime errors anywhere under the root layout (a broken
// page no longer means a raw stack trace or Next's default crash screen).
// console.error here still reaches Vercel's function logs — it's the same
// visibility as before, just paired with a page real users can recover from.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        That&apos;s on us, not you — try again, or head back home.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-accent-green"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
