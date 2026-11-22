"use client";

import { useEffect, useState, useId } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Dialog } from "@/components/Dialog";
import { FilmPicker } from "@/components/FilmPicker";
import type { PickedFilm } from "@/lib/challenges";

type PersonResult = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
};

type DepartmentOption = { department: string; count: number; watched: number };

const CHALLENGE_TYPES = [
  { key: "GENRE", label: "Genre" },
  { key: "TIMEFRAME", label: "Time frame" },
  { key: "CREW", label: "Crew" },
  { key: "CUSTOM", label: "Hand-picked" },
] as const;

type ChallengeTypeKey = (typeof CHALLENGE_TYPES)[number]["key"];

export function NewChallengeForm({ genres }: { genres: string[] }) {
  const router = useRouter();
  const showToast = useToast();
  const titleId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChallengeTypeKey>("GENRE");
  const [saving, setSaving] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const [genreName, setGenreName] = useState(genres[0] ?? "");
  const [genreTarget, setGenreTarget] = useState("10");
  const [genreCounts, setGenreCounts] = useState<Record<string, number> | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeframeTarget, setTimeframeTarget] = useState("10");
  const [timeframeCount, setTimeframeCount] = useState<number | null>(null);
  const [loadingTimeframeCount, setLoadingTimeframeCount] = useState(false);

  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[] | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);

  const [pickedFilms, setPickedFilms] = useState<PickedFilm[]>([]);

  // Fetched once, up front, rather than per-keystroke — there are only a
  // couple dozen genres, so one request covers every option in the select.
  useEffect(() => {
    if (!open || type !== "GENRE" || genreCounts) return;
    fetch("/api/challenges/genre-counts")
      .then((res) => res.json())
      .then((body) => setGenreCounts(body.counts ?? {}))
      .catch(() => setGenreCounts({}));
  }, [open, type, genreCounts]);

  // Timeframe count depends on both dates, so it's refetched whenever either
  // changes rather than fetched once.
  useEffect(() => {
    // Stale timeframeCount from a previous pair of dates never renders once
    // either date is cleared — the JSX below only shows it when both dates
    // are set — so there's nothing to reset here, just nothing to fetch.
    if (!open || type !== "TIMEFRAME" || !startDate || !endDate) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch trigger, not a derived-state effect
    setLoadingTimeframeCount(true);
    fetch(`/api/challenges/timeframe-preview?start=${startDate}&end=${endDate}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setTimeframeCount(typeof body.count === "number" ? body.count : null);
      })
      .catch(() => {
        if (!cancelled) setTimeframeCount(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTimeframeCount(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, type, startDate, endDate]);

  async function searchPeople() {
    if (!personQuery.trim()) return;
    setSearching(true);

    let body: { results?: PersonResult[] } | null;
    try {
      const res = await fetch(`/api/challenges/people?q=${encodeURIComponent(personQuery.trim())}`);
      body = await res.json();
    } catch {
      // Without the catch, a thrown fetch skipped setSearching(false) below
      // and left the Search button reading "Searching..." and disabled for
      // the rest of the page's life.
      setSearching(false);
      showToast("Search failed — try again.", "error");
      return;
    }

    setPersonResults(body?.results ?? []);
    setSearching(false);
  }

  async function selectPerson(person: PersonResult) {
    setSelectedPerson(person);
    setPersonResults([]);
    setDepartments(null);
    setDepartment(null);
    setLoadingDepartments(true);

    let options: DepartmentOption[];
    try {
      const res = await fetch(`/api/challenges/people/${person.id}/departments`);
      const body = await res.json();
      options = body.departments ?? [];
    } catch {
      // Same failure shape as searchPeople: an uncaught throw here left
      // "Loading filmography..." on screen permanently, with no departments
      // ever set and no way forward except the "Change" button.
      setLoadingDepartments(false);
      showToast("Couldn't load that person's filmography — try again.", "error");
      return;
    }

    setDepartments(options);
    // Default to this person's known department (their actual craft) rather
    // than whichever department happens to have the most credits — a
    // prolific director can rack up more "Production" (exec producer)
    // credits than films they actually directed.
    const preferred = options.find((d) => d.department === person.known_for_department);
    setDepartment(preferred?.department ?? options[0]?.department ?? null);
    setLoadingDepartments(false);
  }

  function resetCrewFields() {
    setPersonQuery("");
    setPersonResults([]);
    setSelectedPerson(null);
    setDepartments(null);
    setDepartment(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    let payload: Record<string, unknown>;
    if (type === "GENRE") {
      const target = Number(genreTarget);
      if (!genreName || !Number.isFinite(target) || target < 1) {
        setFormError("Enter how many films, 1 or more.");
        return;
      }
      payload = { type: "GENRE", genreName, target: Math.round(target) };
    } else if (type === "TIMEFRAME") {
      const target = Number(timeframeTarget);
      if (!startDate || !endDate) {
        setFormError("Pick both a start and an end date.");
        return;
      }
      if (endDate < startDate) {
        setFormError("The end date can't be before the start date.");
        return;
      }
      if (!Number.isFinite(target) || target < 1) {
        setFormError("Enter how many films, 1 or more.");
        return;
      }
      payload = { type: "TIMEFRAME", startDate, endDate, target: Math.round(target) };
    } else if (type === "CUSTOM") {
      if (!customTitle.trim()) {
        setFormError("Give the challenge a name.");
        return;
      }
      if (pickedFilms.length === 0) {
        setFormError("Pick at least one film.");
        return;
      }
      payload = { type: "CUSTOM", films: pickedFilms };
    } else {
      if (!selectedPerson || !department) return;
      payload = {
        type: "CREW",
        personId: selectedPerson.id,
        personName: selectedPerson.name,
        department: department === "Acting" ? null : department,
      };
    }

    if (customTitle.trim()) payload.title = customTitle.trim();

    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't create that challenge — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(body?.error ?? "Couldn't create that challenge", "error");
      return;
    }

    showToast("Challenge added");
    setOpen(false);
    setCustomTitle("");
    setPickedFilms([]);
    resetCrewFields();
    router.refresh();
  }

  function close() {
    setOpen(false);
    setCustomTitle("");
    setFormError(null);
    setPickedFilms([]);
    resetCrewFields();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <Plus aria-hidden className="h-4 w-4" />
        New challenge
      </button>

      {open && (
        <Dialog title="New challenge" onClose={close} size="md">
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        role="group"
        aria-label="Kind of challenge"
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border-strong p-1 text-sm"
      >
        {CHALLENGE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={type === t.key}
            onClick={() => {
              setType(t.key);
              setFormError(null);
            }}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              type === t.key ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "GENRE" && (
        <div className="space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Watch</span>
            <input
              type="number"
              min={1}
              value={genreTarget}
              onChange={(e) => setGenreTarget(e.target.value)}
              aria-label="Number of films"
              className="input w-20 text-center"
            />
            <select
              aria-label="Genre"
              value={genreName}
              onChange={(e) => setGenreName(e.target.value)}
              className="input w-auto"
            >
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <span className="text-muted">movies</span>
          </div>
          {genreCounts && (genreCounts[genreName] ?? 0) > 0 && (
            <p className="text-xs text-muted">
              You&apos;ve already logged {genreCounts[genreName]} {genreName} movie
              {genreCounts[genreName] === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      )}

      {type === "TIMEFRAME" && (
        <div className="space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Watch</span>
            <input
              type="number"
              min={1}
              value={timeframeTarget}
              onChange={(e) => setTimeframeTarget(e.target.value)}
              aria-label="Number of films"
              className="input w-20 text-center"
            />
            <span className="text-muted">movies between</span>
            <input
              type="date"
              required
              aria-label="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-auto"
            />
            <span className="text-muted">and</span>
            <input
              type="date"
              required
              aria-label="End date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-auto"
            />
          </div>
          {startDate && endDate && (
            <p className="text-xs text-muted">
              {loadingTimeframeCount
                ? "Checking your diary..."
                : timeframeCount != null &&
                  `You've already logged ${timeframeCount} movie${timeframeCount === 1 ? "" : "s"} in that range.`}
            </p>
          )}
        </div>
      )}

      {type === "CREW" && (
        <div className="space-y-3 text-sm">
          {!selectedPerson ? (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search for a director, actor..."
                  aria-label="Search for a person"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPeople();
                    }
                  }}
                  className="input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={searchPeople}
                  disabled={searching || !personQuery.trim()}
                  className="btn btn-secondary shrink-0"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
              {personResults.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-1">
                  {personResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPerson(p)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-background"
                    >
                      <span>{p.name}</span>
                      {p.known_for_department && (
                        <span className="text-xs text-muted">{p.known_for_department}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>{selectedPerson.name}</span>
                <button
                  type="button"
                  onClick={resetCrewFields}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Change
                </button>
              </div>
              {loadingDepartments ? (
                <p className="text-xs text-muted">Loading filmography...</p>
              ) : departments && departments.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1">
                    {departments.map((d) => (
                      <button
                        key={d.department}
                        type="button"
                        onClick={() => setDepartment(d.department)}
                        aria-pressed={department === d.department}
                        className={`chip ${department === d.department ? "chip-active" : "hover:text-foreground"}`}
                      >
                        {d.department} ({d.count})
                      </button>
                    ))}
                  </div>
                  {department &&
                    (() => {
                      const selected = departments.find((d) => d.department === department);
                      return selected && selected.watched > 0 ? (
                        <p className="text-xs text-muted">
                          You&apos;ve already watched {selected.watched} of {selected.count}.
                        </p>
                      ) : null;
                    })()}
                </>
              ) : departments ? (
                <p className="text-xs text-muted">No movie credits found for this person.</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {type === "CUSTOM" && <FilmPicker films={pickedFilms} onChange={setPickedFilms} />}

      <div>
        <label htmlFor={titleId} className="field-label">
          Name{" "}
          {type !== "CUSTOM" && <span className="font-normal text-subtle">(optional)</span>}
        </label>
        <input
          id={titleId}
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={
            type === "CUSTOM"
              ? "e.g. Oscar winners I've never seen"
              : "We'll name it for you if you leave this blank"
          }
          required={type === "CUSTOM"}
          maxLength={100}
          className="input"
        />
      </div>

      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button type="button" onClick={close} className="btn btn-ghost">
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            saving ||
            (type === "CREW" && (!selectedPerson || !department)) ||
            (type === "CUSTOM" && pickedFilms.length === 0)
          }
          className="btn btn-primary"
        >
          {saving ? "Adding…" : "Add challenge"}
        </button>
      </div>
    </form>
        </Dialog>
      )}
    </>
  );
}
