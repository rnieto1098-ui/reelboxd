"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WatchlistImportSummary = {
  imported: number;
  unmatched: { title: string; year: string }[];
};

export function WatchlistImportForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<WatchlistImportSummary | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/watchlist/import", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSummary(data);
    setFile(null);
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-muted hover:text-accent-green hover:underline"
      >
        Import to watchlist
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-96 max-w-[90vw] rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Import to watchlist</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">
            Upload a Letterboxd watchlist.csv (or the full export .zip from{" "}
            <a
              href="https://letterboxd.com/user/exportdata/"
              target="_blank"
              rel="noreferrer"
              className="text-accent-green hover:underline"
            >
              letterboxd.com/user/exportdata
            </a>
            ), or a watchlist.csv you exported from Flixtally — everything in it gets added straight
            to your watchlist. Ratings and other data are ignored; use{" "}
            <a href="/import" className="text-accent-green hover:underline">
              full import
            </a>{" "}
            for those.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,.zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-green file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
            />
            <button
              type="submit"
              disabled={!file || loading}
              className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {summary && (
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                Added <span className="text-accent-green">{summary.imported}</span> movie
                {summary.imported === 1 ? "" : "s"} to your watchlist.
              </p>
              {summary.unmatched.length > 0 && (
                <div>
                  <p className="text-sm text-muted">
                    Couldn&apos;t find a match for {summary.unmatched.length} title
                    {summary.unmatched.length === 1 ? "" : "s"}:
                  </p>
                  <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted">
                    {summary.unmatched.map((m, i) => (
                      <li key={i}>
                        {m.title} {m.year && `(${m.year})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
