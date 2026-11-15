"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Flame,
  Lock,
  Search,
  Share2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  MAX_GUESSES,
  posterBlur,
  shareText,
  type Clue,
  type GameStats,
  type GuessFeedback,
} from "@/lib/dailyGame";
import type { SearchSuggestion } from "@/app/api/search/route";

type FilmRef = { tmdbId: number; title: string; year: number | null };
type Guess = FilmRef & { feedback: GuessFeedback };
type Outcome = "won" | "lost";

// What is kept in the browser between visits so a refresh doesn't lose a
// game in progress. One entry per puzzle day.
type SavedGame = {
  guesses: Guess[];
  clues: Clue[];
  outcome: Outcome | null;
  answer: FilmRef | null;
};

const CLUE_COUNT = 6;
const SEARCH_DEBOUNCE_MS = 250;

function storageKey(day: string) {
  return `flixtally:daily-reel:${day}`;
}

function loadSaved(day: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(storageKey(day));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGame;
    if (!Array.isArray(parsed.guesses) || !Array.isArray(parsed.clues)) return null;
    return parsed;
  } catch {
    // Private browsing, a full disk or a hand-edited value: start fresh.
    return null;
  }
}

function save(day: string, game: SavedGame) {
  try {
    localStorage.setItem(storageKey(day), JSON.stringify(game));
  } catch {
    // Nothing to do: the game still works, it just won't survive a refresh.
  }
}

export function DailyGame({
  day,
  number,
  poster,
  firstClue,
  signedIn,
  stats,
  serverResult,
}: {
  day: string;
  number: number;
  poster: string | null;
  firstClue: Clue;
  signedIn: boolean;
  stats: GameStats | null;
  // A signed-in player's saved result for today, if they already finished
  // (possibly on another device).
  serverResult: { solved: boolean; attempts: number; answer: FilmRef } | null;
}) {
  const router = useRouter();
  const showToast = useToast();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [clues, setClues] = useState<Clue[]>([firstClue]);
  const [outcome, setOutcome] = useState<Outcome | null>(
    serverResult ? (serverResult.solved ? "won" : "lost") : null
  );
  const [answer, setAnswer] = useState<FilmRef | null>(serverResult?.answer ?? null);
  // False until the saved game has been read from the browser. The board is
  // held back until then so a game in progress never flashes as a new one.
  const [ready, setReady] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nextIn, setNextIn] = useState<string | null>(null);

  // Restore a game in progress. localStorage only exists in the browser, so
  // this has to happen after the first render rather than during it.
  useEffect(() => {
    const saved = loadSaved(day);
    /* eslint-disable react-hooks/set-state-in-effect -- reading an external store (localStorage) on mount */
    if (saved) {
      setGuesses(saved.guesses);
      // A result saved to the account wins over this browser's copy.
      if (!serverResult) {
        setClues(saved.clues.length > 0 ? saved.clues : [firstClue]);
        setOutcome(saved.outcome);
        setAnswer(saved.answer);
      }
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [day, firstClue, serverResult]);

  // Time until the next puzzle (midnight UTC). Updated twice a minute: it is
  // shown to the minute, so ticking every second would only waste renders.
  useEffect(() => {
    function update() {
      const now = new Date();
      const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const minutes = Math.max(0, Math.ceil((midnight - now.getTime()) / 60000));
      setNextIn(`${Math.floor(minutes / 60)}h ${minutes % 60}m`);
    }
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  const trimmed = query.trim();

  // Film search for the guess box. Each keystroke cancels the previous
  // request so a slow reply for "god" can't replace the results for
  // "godfather".
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: { results: SearchSuggestion[] } = await res.json();
        setSuggestions(data.results);
        setActive(0);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const guessedIds = new Set(guesses.map((g) => g.tmdbId));
  const options = trimmed.length < 2 ? [] : suggestions.filter((s) => !guessedIds.has(s.id));
  const finished = outcome != null;
  const wrongCount = guesses.filter((g) => !g.feedback.correct).length;
  const guessesUsed = serverResult ? serverResult.attempts : guesses.length;

  async function submit(film: SearchSuggestion) {
    if (submitting || finished) return;
    setSubmitting(true);
    setQuery("");
    setSuggestions([]);

    let res: Response;
    try {
      res = await fetch("/api/play/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, tmdbId: film.id, guessNumber: guesses.length + 1 }),
      });
    } catch {
      setSubmitting(false);
      showToast("Couldn't check that guess. Try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (res.status === 409 && body?.stale) {
      // The day rolled over while this tab was open.
      showToast("A new puzzle is out. Loading it now.");
      router.refresh();
      return;
    }
    if (!res.ok || !body?.feedback) {
      showToast(body?.error ?? "Couldn't check that guess. Try again.", "error");
      return;
    }

    const guess: Guess = { ...body.guess, feedback: body.feedback };
    const nextGuesses = [...guesses, guess];
    const nextClues = body.nextClue ? [...clues, body.nextClue as Clue] : clues;
    const nextOutcome: Outcome | null = body.feedback.correct
      ? "won"
      : nextGuesses.length >= MAX_GUESSES
        ? "lost"
        : null;
    const nextAnswer: FilmRef | null = body.answer ?? null;

    setGuesses(nextGuesses);
    setClues(nextClues);
    setOutcome(nextOutcome);
    setAnswer(nextAnswer);
    save(day, { guesses: nextGuesses, clues: nextClues, outcome: nextOutcome, answer: nextAnswer });

    if (nextOutcome === "won") {
      showToast(
        nextGuesses.length === 1 ? "First guess! Remarkable." : `Solved in ${nextGuesses.length}.`,
        "celebrate"
      );
    }
    if (nextOutcome) {
      // Refresh the streak and stats, which the server just updated.
      if (signedIn) router.refresh();
    } else {
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(options[Math.min(active, options.length - 1)]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }

  async function share() {
    const text = shareText(number, guessesUsed, outcome === "won");
    try {
      await navigator.clipboard.writeText(text);
      showToast("Result copied. Paste it anywhere.");
    } catch {
      showToast("Couldn't copy the result.", "error");
    }
  }

  const blur = posterBlur(wrongCount, finished);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
      {/* Poster: blurred until the game ends, sharper with each wrong guess. */}
      <div className="mx-auto w-full max-w-[260px] lg:max-w-none">
        <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-white/15">
          {poster ? (
            <Image
              src={poster}
              alt={finished && answer ? `${answer.title} poster` : "Blurred poster of the mystery film"}
              fill
              sizes="300px"
              priority
              draggable={false}
              className="select-none object-cover transition-[filter,transform] duration-700 ease-out"
              // Scaled up a little while blurred so the soft edges of the
              // blur don't show the frame behind.
              style={{ filter: `blur(${blur}px)`, transform: blur > 0 ? "scale(1.12)" : "scale(1)" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-subtle">
              <Clapperboard aria-hidden className="h-12 w-12" />
            </div>
          )}
          {!finished && (
            <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              Guess {Math.min(guesses.length + 1, MAX_GUESSES)} of {MAX_GUESSES}
            </span>
          )}
        </div>

        {signedIn && stats ? (
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Flame, label: "Streak", value: stats.currentStreak },
              { icon: Trophy, label: "Best", value: stats.bestStreak },
              { icon: Check, label: "Win rate", value: `${stats.winRate}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="card px-2 py-3">
                <Icon aria-hidden className="mx-auto mb-1 h-4 w-4 text-accent-green" />
                <dd className="font-[family-name:var(--font-display)] text-xl font-bold leading-none tabular-nums">
                  {value}
                </dd>
                <dt className="mt-1 text-[11px] text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        ) : (
          !signedIn && (
            <p className="mt-5 rounded-xl border border-dashed border-border-strong px-4 py-3 text-center text-sm text-muted">
              <Link
                href="/login?next=/play"
                className="font-medium text-accent-green underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to keep a streak and see your stats.
            </p>
          )
        )}
      </div>

      <div className="min-w-0">
        {/* Result */}
        {finished && (
          <div
            className={`card mb-6 animate-scale-in p-5 ${
              outcome === "won" ? "border-accent-green/45 bg-gradient-to-br from-accent-green-soft to-surface" : ""
            }`}
            role="status"
          >
            <p className="eyebrow mb-1">{outcome === "won" ? "Solved" : "Out of guesses"}</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
              {answer ? (
                <>
                  {answer.title}
                  {answer.year != null && (
                    <span className="ml-2 text-lg font-medium text-muted">({answer.year})</span>
                  )}
                </>
              ) : (
                "Today's puzzle is done"
              )}
            </p>
            <p className="mt-1 text-sm text-muted">
              {outcome === "won"
                ? `You got it in ${guessesUsed} of ${MAX_GUESSES}.`
                : "Better luck tomorrow."}
              {nextIn && ` Next film in ${nextIn}.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {answer && (
                <Link href={`/movie/${answer.tmdbId}`} className="btn btn-primary">
                  View the film
                </Link>
              )}
              <button type="button" onClick={share} className="btn btn-secondary">
                <Share2 aria-hidden className="h-4 w-4" />
                Share result
              </button>
            </div>
          </div>
        )}

        {/* Clues */}
        <section aria-labelledby="clues-heading" className="mb-6">
          <h2 id="clues-heading" className="section-title mb-3">
            Clues
          </h2>
          <ol className="space-y-2">
            {Array.from({ length: CLUE_COUNT }, (_, i) => {
              const clue = ready ? clues[i] : i === 0 ? firstClue : undefined;
              return clue ? (
                <li
                  key={i}
                  className="card flex animate-fade-up items-start gap-3 px-4 py-3"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-green text-xs font-bold text-black">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
                      {clue.label}
                    </span>
                    <span className="block text-[15px] font-medium">{clue.text}</span>
                  </span>
                </li>
              ) : (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-[0.875rem] border border-dashed border-border px-4 py-3 text-sm text-subtle"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong">
                    <Lock aria-hidden className="h-3 w-3" />
                  </span>
                  {finished ? "Not needed" : "Unlocks after a wrong guess"}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Guess box */}
        {ready && !finished && (
          <div className="relative mb-6">
            <label htmlFor={inputId} className="field-label">
              Your guess
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              />
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={options.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={options.length > 0 ? `${listId}-${active}` : undefined}
                autoComplete="off"
                value={query}
                disabled={submitting}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim().length < 2) setSuggestions([]);
                }}
                onKeyDown={handleKeyDown}
                placeholder={submitting ? "Checking…" : "Type a film title, then pick it from the list"}
                className="input h-12 pl-10 text-base"
              />
            </div>
            {trimmed.length >= 2 && (
              <ul
                id={listId}
                role="listbox"
                aria-label="Matching films"
                className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border-strong bg-surface-raised shadow-pop"
              >
                {options.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted">
                    {searching ? "Searching…" : "No films match that."}
                  </li>
                ) : (
                  options.map((film, i) => (
                    <li key={film.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        onClick={() => submit(film)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                          i === active ? "bg-white/[0.07]" : ""
                        }`}
                      >
                        <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-background ring-1 ring-white/10">
                          {film.poster && (
                            <Image src={film.poster} alt="" fill sizes="32px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{film.title}</span>
                          {film.year && <span className="block text-xs text-muted">{film.year}</span>}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        {/* Guesses so far */}
        {guesses.length > 0 && (
          <section aria-labelledby="guesses-heading">
            <h2 id="guesses-heading" className="section-title mb-3">
              Your guesses
            </h2>
            <ol className="space-y-2">
              {guesses.map((guess, i) => (
                <GuessRow key={guess.tmdbId} index={i} guess={guess} />
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

function GuessRow({ index, guess }: { index: number; guess: Guess }) {
  const f = guess.feedback;
  const hints: { key: string; icon: React.ReactNode; text: string; hit: boolean }[] = [];

  if (!f.correct) {
    if (f.year === "newer") {
      hints.push({ key: "year", icon: <ArrowUp className="h-3 w-3" />, text: "Answer is newer", hit: false });
    } else if (f.year === "older") {
      hints.push({ key: "year", icon: <ArrowDown className="h-3 w-3" />, text: "Answer is older", hit: false });
    } else if (f.year === "same") {
      hints.push({ key: "year", icon: <Check className="h-3 w-3" />, text: "Same year", hit: true });
    }
    if (f.sameDirector) {
      hints.push({ key: "director", icon: <Clapperboard className="h-3 w-3" />, text: "Same director", hit: true });
    }
    if (f.sharedGenres.length > 0) {
      hints.push({
        key: "genres",
        icon: <Check className="h-3 w-3" />,
        text: `Shares ${f.sharedGenres.join(", ")}`,
        hit: true,
      });
    }
    if (f.sharedCast.length > 0) {
      hints.push({
        key: "cast",
        icon: <Users className="h-3 w-3" />,
        text: `Also has ${f.sharedCast.join(", ")}`,
        hit: true,
      });
    }
  }

  return (
    <li
      className={`card animate-fade-up px-4 py-3 ${f.correct ? "border-accent-green/50 bg-accent-green-soft" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            f.correct ? "bg-accent-green text-black" : "bg-white/20 text-foreground"
          }`}
        >
          {f.correct ? (
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
          )}
        </span>
        <p className="min-w-0 flex-1 truncate font-medium">
          <span className="sr-only">
            Guess {index + 1}, {f.correct ? "correct" : "wrong"}:{" "}
          </span>
          {guess.title}
          {guess.year != null && <span className="ml-1.5 font-normal text-muted">({guess.year})</span>}
        </p>
      </div>
      {hints.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-9">
          {hints.map((hint) => (
            <li
              key={hint.key}
              className={`chip ${hint.hit ? "border-accent-green/50 text-accent-green" : "text-foreground/85"}`}
            >
              {hint.icon}
              {hint.text}
            </li>
          ))}
        </ul>
      )}
      {!f.correct && hints.length === 0 && (
        <p className="mt-1 pl-9 text-xs text-muted">Nothing in common with the answer.</p>
      )}
    </li>
  );
}
