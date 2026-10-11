"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type ListImportSummary = {
  imported: number;
  // Watchlist only: films already seen don't go on a watchlist.
  skippedWatched?: number;
  // Rewatch list only: films that were on it before this import.
  alreadyOnList?: number;
  unmatched: { title: string; year: string }[];
};

export function ListImportForm({
  endpoint,
  listName,
  description,
}: {
  endpoint: string;
  listName: string;
  description: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ListImportSummary | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    let res: Response;
    try {
      res = await fetch(endpoint, { method: "POST", body: formData });
    } catch {
      setLoading(false);
      setError("Something went wrong — try again.");
      return;
    }

    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error ?? "Something went wrong");
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
        Import to {listName}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 sm:left-auto sm:right-0 mt-2 w-96 max-w-[90vw] rounded-lg border border-border bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Import to {listName}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
          <p className="mb-3 text-xs text-muted">{description}</p>

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
                {summary.imported === 1 ? "" : "s"} to your {listName}.
              </p>
              {(summary.skippedWatched ?? 0) > 0 && (
                <p className="text-sm text-muted">
                  Skipped {summary.skippedWatched} you&apos;ve already watched — a watched movie
                  doesn&apos;t go back on your watchlist.
                </p>
              )}
              {(summary.alreadyOnList ?? 0) > 0 && (
                <p className="text-sm text-muted">
                  {summary.alreadyOnList} {summary.alreadyOnList === 1 ? "was" : "were"} already on
                  your {listName}.
                </p>
              )}
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
