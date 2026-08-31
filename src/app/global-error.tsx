"use client";

import { useEffect } from "react";

// error.tsx only covers errors under the root layout — if the root layout
// itself throws (e.g. the session/background-image lookup in layout.tsx),
// this is the only boundary that can still catch it. Has to render its own
// <html>/<body> since it replaces the root layout entirely while active.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#14181c",
          color: "#e7e9eb",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", color: "#9aa4af", fontSize: "0.875rem" }}>
          That&apos;s on us, not you — try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            borderRadius: "0.375rem",
            background: "#00e054",
            color: "#000",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
