"use client";

import { useRef, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import type { TmdbMovieSummary } from "@/lib/tmdb";
import type { ParsedPrompt } from "@/lib/promptRecommender";

type ApiResponse = {
  parsed: ParsedPrompt;
  similarToMovie: { id: number; title: string } | null;
  results: TmdbMovieSummary[];
  relaxed: boolean;
};

const PLACEHOLDER =
  "Optional: describe the vibe, or a movie it should feel like — e.g. \"similar to Mad Max, highly rated\"";

const GENRE_PRESETS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
];

const RUNTIME_PRESETS = [
  { label: "Under 1h 30m", maxMinutes: 90 },
  { label: "Under 2h", maxMinutes: 120 },
  { label: "Under 2h 30m", maxMinutes: 150 },
  { label: "Under 3h", maxMinutes: 180 },
];

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        selected
          ? "border-accent-green bg-accent-green text-black"
          : "border-border text-muted hover:text-foreground hover:border-accent-green"
      }`}
    >
      {label}
    </button>
  );
}

export function RecommendForm() {
  const [prompt, setPrompt] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());
  const [selectedRuntimes, setSelectedRuntimes] = useState<Set<number>>(new Set());
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [onlyStreaming, setOnlyStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  // Lets a repeat click of "Recommend me something" — same criteria, nothing
  // changed — surface a different set instead of the same one. Refs, not
  // state: this bookkeeping doesn't drive any rendering itself.
  const lastCriteriaRef = useRef<string | null>(null);
  const shownIdsRef = useRef<number[]>([]);

  const hasSelection =
    prompt.trim().length > 0 ||
    selectedGenres.size > 0 ||
    selectedRuntimes.size > 0 ||
    onlyWatchlist ||
    onlyStreaming;

  function toggleGenre(genre: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }

  function toggleRuntime(maxMinutes: number) {
    setSelectedRuntimes((prev) => {
      const next = new Set(prev);
      if (next.has(maxMinutes)) next.delete(maxMinutes);
      else next.add(maxMinutes);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSelection) return;

    setLoading(true);
    setError(null);
    setData(null);

    // Multiple runtime chips can be selected at once — take the most
    // restrictive (smallest) cap among them.
    const maxRuntimeMinutes = selectedRuntimes.size > 0 ? Math.min(...selectedRuntimes) : null;

    // Same criteria as the last submit — a genuine "click again" — so ask
    // the server to leave out what it just showed. Anything different
    // (including the very first submit) starts a fresh exclusion history.
    const criteria = JSON.stringify({
      prompt: prompt.trim(),
      genres: [...selectedGenres].sort(),
      maxRuntimeMinutes,
      onlyWatchlist,
      onlyStreaming,
    });
    const isRepeat = criteria === lastCriteriaRef.current;
    const excludeIds = isRepeat ? shownIdsRef.current : [];

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        genres: [...selectedGenres],
        maxRuntimeMinutes,
        onlyWatchlist,
        onlyStreaming,
        excludeIds,
      }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      return;
    }

    lastCriteriaRef.current = criteria;
    const newIds: number[] = body.results.map((m: TmdbMovieSummary) => m.id);
    // Bounded well under the API's excludeIds cap (100) so a long streak of
    // repeat clicks never fails validation — recent history is what matters
    // for "give me something different" anyway.
    shownIdsRef.current = (isRepeat ? [...excludeIds, ...newIds] : newIds).slice(-60);

    setData(body);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-muted">Genre</p>
          <div className="flex flex-wrap gap-2">
            {GENRE_PRESETS.map((genre) => (
              <Chip
                key={genre}
                label={genre}
                selected={selectedGenres.has(genre)}
                onClick={() => toggleGenre(genre)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted">Runtime</p>
          <div className="flex flex-wrap gap-2">
            {RUNTIME_PRESETS.map((preset) => (
              <Chip
                key={preset.maxMinutes}
                label={preset.label}
                selected={selectedRuntimes.has(preset.maxMinutes)}
                onClick={() => toggleRuntime(preset.maxMinutes)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-muted">Availability</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="On watchlist"
              selected={onlyWatchlist}
              onClick={() => setOnlyWatchlist((v) => !v)}
            />
            <Chip
              label="On your services"
              selected={onlyStreaming}
              onClick={() => setOnlyStreaming((v) => !v)}
            />
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent-green"
        />
        <button
          type="submit"
          disabled={loading || !hasSelection}
          className="rounded-md bg-accent-green px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Finding movies..." : "Recommend me something"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {data && (
        <div className="mt-8">
          <PromptSummary data={data} />

          {data.results.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Couldn&apos;t find anything matching that — try loosening the request a bit.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {data.results.map((movie) => (
                <MovieCard
                  key={movie.id}
                  tmdbId={movie.id}
                  title={movie.title}
                  posterPath={movie.poster_path}
                  year={movie.release_date?.slice(0, 4)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PromptSummary({ data }: { data: ApiResponse }) {
  const { parsed, similarToMovie, relaxed } = data;
  const bits: string[] = [];

  if (parsed.genreNames.length > 0) bits.push(parsed.genreNames.join(", "));
  if (similarToMovie) bits.push(`similar to ${similarToMovie.title}`);
  if (parsed.runtimeMaxMinutes) bits.push(`under ${formatMinutes(parsed.runtimeMaxMinutes)}`);
  if (parsed.runtimeMinMinutes) bits.push(`over ${formatMinutes(parsed.runtimeMinMinutes)}`);
  if (parsed.minRating10) bits.push(`rated ${parsed.minRating10.toFixed(1)}+/10`);
  if (parsed.onlyWatchlist) bits.push("on your watchlist");
  if (parsed.onlyStreaming) bits.push("on your streaming services");

  return (
    <div className="text-sm text-muted">
      {bits.length > 0 ? (
        <p>
          Looking for: <span className="text-foreground">{bits.join(" · ")}</span>
        </p>
      ) : (
        <p>Didn&apos;t catch specific filters from that — showing popular picks instead.</p>
      )}
      {relaxed && (
        <p className="mt-1 text-xs">
          Loosened some of those filters to find enough good matches.
        </p>
      )}
    </div>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
