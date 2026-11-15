"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import type { SearchSuggestion } from "@/app/api/search/route";

const DEBOUNCE_MS = 300;

type Status = "idle" | "loading" | "done" | "error";

export function SearchBox() {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted; results.length = the "See all results" row.
  const [active, setActive] = useState(-1);
  // Navigating to /search renders on the server and waits on TMDB — without
  // this, pressing Enter looked like it did nothing until the page arrived.
  const [navigating, startNavigation] = useTransition();

  const trimmed = query.trim();

  // Debounced fetch; each new keystroke aborts the previous request so a
  // slow response for "godf" can't overwrite the results for "godfather".
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: { results: SearchSuggestion[] } = await res.json();
        setResults(data.results);
        setStatus("done");
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Close when clicking or tabbing anywhere outside the box + dropdown.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // "/" jumps to search from anywhere, the convention on most large sites.
  // Ignored while typing in another field so it can still be typed there.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    startNavigation(() => router.push(href));
  }

  function searchAll() {
    if (trimmed) go(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (!value.trim()) {
      setResults([]);
      setStatus("idle");
    } else {
      // Show "Searching…" immediately rather than stale results from the
      // previous query during the debounce window.
      setStatus("loading");
    }
  }

  const showDropdown = open && trimmed.length > 0;
  const rowCount = status === "done" ? results.length + 1 : 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (showDropdown) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!showDropdown) {
        setOpen(true);
        return;
      }
      if (rowCount === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        const next = i + step;
        if (next < -1) return rowCount - 1;
        if (next >= rowCount) return -1;
        return next;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showDropdown && active >= 0 && active < results.length) {
        go(`/movie/${results[active].id}`);
      } else {
        searchAll();
      }
    }
  }

  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  return (
    <div ref={containerRef} className="w-full min-w-0 sm:relative sm:max-w-sm">
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          searchAll();
        }}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
        />
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search films…"
          aria-label="Search films and people"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showDropdown && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          className="h-9 w-full rounded-full border border-white/10 bg-white/[0.06] pl-9 pr-9 text-sm text-foreground transition-[border-color,background-color,box-shadow] placeholder:text-subtle hover:border-white/20 focus:border-accent-green focus:bg-white/[0.09] focus:shadow-[0_0_0_3px_var(--accent-green-soft)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {navigating ? (
          <span
            role="status"
            aria-label="Loading results"
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted border-t-accent-green"
          />
        ) : (
          !query && (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-[10px] font-medium leading-4 text-subtle xl:block"
            >
              /
            </kbd>
          )
        )}
      </form>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          // On phones the box itself is narrow, so the suggestions span the
          // screen under the header instead of hanging off the box (where
          // they ran past the right edge).
          className="fixed inset-x-3 top-[calc(var(--header-height)+env(safe-area-inset-top)+0.25rem)] z-50 animate-scale-in overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-pop sm:absolute sm:inset-x-0 sm:top-full sm:mt-2 sm:min-w-[20rem] sm:origin-top"
        >
          {status === "loading" && <p className="px-3 py-2.5 text-sm text-muted">Searching…</p>}
          {status === "error" && (
            <p className="px-3 py-2.5 text-sm text-muted">Search isn&apos;t available right now.</p>
          )}
          {status === "done" && results.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-muted">No results for &ldquo;{trimmed}&rdquo;</p>
          )}
          {status === "done" &&
            results.map((movie, i) => (
              <a
                key={movie.id}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                href={`/movie/${movie.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(`/movie/${movie.id}`);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 px-3 py-2 ${active === i ? "bg-white/[0.07]" : ""}`}
              >
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-background ring-1 ring-white/10">
                  {movie.poster ? (
                    <Image src={movie.poster} alt="" fill sizes="32px" className="object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-gradient-to-b from-surface-hover to-background" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{movie.title}</span>
                  {movie.year && <span className="block text-xs text-muted">{movie.year}</span>}
                </span>
              </a>
            ))}
          {status === "done" && (
            <a
              id={optionId(results.length)}
              role="option"
              aria-selected={active === results.length}
              href={`/search?q=${encodeURIComponent(trimmed)}`}
              onClick={(e) => {
                e.preventDefault();
                searchAll();
              }}
              onMouseEnter={() => setActive(results.length)}
              className={`block border-t border-border px-3 py-2.5 text-sm font-medium text-accent-green ${active === results.length ? "bg-white/[0.07]" : ""}`}
            >
              See all results for &ldquo;{trimmed}&rdquo;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
