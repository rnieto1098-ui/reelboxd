"use client";

import { useEffect, useState } from "react";
import { Check, Film, Plus, Search, X } from "lucide-react";
import type { PickedFilm } from "@/lib/challenges";
import type { SearchSuggestion } from "@/app/api/search/route";

const SEARCH_DELAY_MS = 250;

function thumb(posterPath: string | null): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/w92${posterPath}` : null;
}

function Poster({ src, title }: { src: string | null; title: string }) {
  return src ? (
    // Straight from TMDB's CDN at thumbnail size; nothing to optimise.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-12 w-8 shrink-0 rounded object-cover" loading="lazy" />
  ) : (
    <span
      aria-label={title}
      className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-white/5 text-subtle"
    >
      <Film aria-hidden className="h-4 w-4" />
    </span>
  );
}

/**
 * Search TMDB and build up a hand-picked set of films. Results toggle in and
 * out of the set; the set itself is listed underneath with a remove button
 * on each film.
 */
export function FilmPicker({
  films,
  onChange,
}: {
  films: PickedFilm[];
  onChange: (films: PickedFilm[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((body) => {
          setResults(body.results ?? []);
          if (body.error) setError(body.error);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setError("Search failed. Try again.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const pickedIds = new Set(films.map((f) => f.tmdbId));

  function toggle(result: SearchSuggestion) {
    if (pickedIds.has(result.id)) {
      onChange(films.filter((f) => f.tmdbId !== result.id));
    } else {
      onChange([
        ...films,
        {
          tmdbId: result.id,
          title: result.title,
          posterPath: result.posterPath,
          releaseDate: result.releaseDate,
        },
      ]);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter would submit the surrounding form.
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder="Search for a film to add"
          aria-label="Search for a film to add"
          className="input pl-9"
        />
      </div>

      {trimmed && (
        <div className="max-h-64 overflow-y-auto rounded-md border border-border p-1">
          {searching && results.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">Searching…</p>
          ) : error ? (
            <p className="px-2 py-3 text-xs text-danger">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">No films match that.</p>
          ) : (
            results.map((r) => {
              const picked = pickedIds.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={picked}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-background"
                >
                  <Poster src={r.poster} title={r.title} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.title}</span>
                    {r.year && <span className="text-xs text-muted">{r.year}</span>}
                  </span>
                  {picked ? (
                    <Check aria-label="Added" className="h-4 w-4 shrink-0 text-accent-green" />
                  ) : (
                    <Plus aria-label="Add" className="h-4 w-4 shrink-0 text-muted" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <div>
        <p className="field-label">
          {films.length === 0
            ? "No films picked yet"
            : `${films.length} film${films.length === 1 ? "" : "s"} picked`}
        </p>
        {films.length > 0 && (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {films.map((f) => (
              <li
                key={f.tmdbId}
                className="flex items-center gap-3 rounded-md border border-border px-2 py-1.5"
              >
                <Poster src={thumb(f.posterPath)} title={f.title} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.title}</span>
                  {f.releaseDate && (
                    <span className="text-xs text-muted">{f.releaseDate.slice(0, 4)}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(films.filter((x) => x.tmdbId !== f.tmdbId))}
                  aria-label={`Remove ${f.title}`}
                  className="rounded p-1 text-muted hover:bg-white/5 hover:text-foreground"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
