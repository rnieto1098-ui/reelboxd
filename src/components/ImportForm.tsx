"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type ImportSummary = {
  ratingsImported: number;
  watchlistImported: number;
  diaryImported: number;
  unmatched: { title: string; year: string }[];
  completedChallenges: { id: string; title: string }[];
  completedGoal: { year: number; target: number } | null;
};

export function ImportForm() {
  const router = useRouter();
  const showToast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/import/letterboxd", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSummary(data);
    for (const challenge of data.completedChallenges ?? []) {
      showToast(`🎉 Challenge complete: ${challenge.title}`);
    }
    if (data.completedGoal) {
      showToast(`🎉 ${data.completedGoal.year} watch goal complete!`);
    }
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-accent-green file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
        />
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Importing... this can take a minute" : "Import"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {summary && (
        <div className="mt-6 space-y-3">
          <p className="text-sm">
            Imported <span className="text-accent-green">{summary.diaryImported}</span> diary
            {summary.diaryImported === 1 ? " entry" : " entries"},{" "}
            <span className="text-accent-green">{summary.ratingsImported}</span> rating
            {summary.ratingsImported === 1 ? "" : "s"}, and{" "}
            <span className="text-accent-green">{summary.watchlistImported}</span> watchlist item
            {summary.watchlistImported === 1 ? "" : "s"}.
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
  );
}
