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
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="page-title">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        That&apos;s on us, not you — try again, or head back home.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary"
        >
          Try again
        </button>
        <Link
          href="/"
          className="btn btn-secondary"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
