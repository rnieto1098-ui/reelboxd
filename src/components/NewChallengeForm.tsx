"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type PersonResult = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string | null;
};

type DepartmentOption = { department: string; count: number };

const CHALLENGE_TYPES = [
  { key: "GENRE", label: "Genre" },
  { key: "TIMEFRAME", label: "Time frame" },
  { key: "CREW", label: "Crew" },
] as const;

type ChallengeTypeKey = (typeof CHALLENGE_TYPES)[number]["key"];

export function NewChallengeForm({ genres }: { genres: string[] }) {
  const router = useRouter();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChallengeTypeKey>("GENRE");
  const [saving, setSaving] = useState(false);

  const [genreName, setGenreName] = useState(genres[0] ?? "");
  const [genreTarget, setGenreTarget] = useState("10");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeframeTarget, setTimeframeTarget] = useState("10");

  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[] | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [department, setDepartment] = useState<string | null>(null);

  async function searchPeople() {
    if (!personQuery.trim()) return;
    setSearching(true);
    const res = await fetch(`/api/challenges/people?q=${encodeURIComponent(personQuery.trim())}`);
    const body = await res.json();
    setPersonResults(body.results ?? []);
    setSearching(false);
  }

  async function selectPerson(person: PersonResult) {
    setSelectedPerson(person);
    setPersonResults([]);
    setDepartments(null);
    setDepartment(null);
    setLoadingDepartments(true);
    const res = await fetch(`/api/challenges/people/${person.id}/departments`);
    const body = await res.json();
    const options: DepartmentOption[] = body.departments ?? [];
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

    let payload: Record<string, unknown>;
    if (type === "GENRE") {
      const target = Number(genreTarget);
      if (!genreName || !Number.isFinite(target) || target < 1) return;
      payload = { type: "GENRE", genreName, target: Math.round(target) };
    } else if (type === "TIMEFRAME") {
      const target = Number(timeframeTarget);
      if (!startDate || !endDate || !Number.isFinite(target) || target < 1) return;
      payload = { type: "TIMEFRAME", startDate, endDate, target: Math.round(target) };
    } else {
      if (!selectedPerson || !department) return;
      payload = {
        type: "CREW",
        personId: selectedPerson.id,
        personName: selectedPerson.name,
        department: department === "Acting" ? null : department,
      };
    }

    setSaving(true);
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setSaving(false);

    if (!res.ok) {
      showToast(body.error ?? "Couldn't create that challenge", "error");
      return;
    }

    showToast("Challenge added");
    setOpen(false);
    resetCrewFields();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 transition-opacity"
      >
        + New challenge
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex w-fit gap-1 rounded-full border border-border p-1 text-xs">
        {CHALLENGE_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`rounded-full px-3 py-1 transition-colors ${
              type === t.key ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "GENRE" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Watch</span>
          <input
            type="number"
            min={1}
            value={genreTarget}
            onChange={(e) => setGenreTarget(e.target.value)}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center focus:outline-none focus:border-accent-green"
          />
          <select
            value={genreName}
            onChange={(e) => setGenreName(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:border-accent-green"
          >
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span className="text-muted">movies</span>
        </div>
      )}

      {type === "TIMEFRAME" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Watch</span>
          <input
            type="number"
            min={1}
            value={timeframeTarget}
            onChange={(e) => setTimeframeTarget(e.target.value)}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center focus:outline-none focus:border-accent-green"
          />
          <span className="text-muted">movies between</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:border-accent-green"
          />
          <span className="text-muted">and</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:border-accent-green"
          />
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchPeople();
                    }
                  }}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 placeholder:text-muted focus:outline-none focus:border-accent-green"
                />
                <button
                  type="button"
                  onClick={searchPeople}
                  disabled={searching || !personQuery.trim()}
                  className="rounded-md border border-border px-3 py-1.5 text-muted hover:text-foreground disabled:opacity-50"
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
                <div className="flex flex-wrap gap-1">
                  {departments.map((d) => (
                    <button
                      key={d.department}
                      type="button"
                      onClick={() => setDepartment(d.department)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        department === d.department
                          ? "bg-accent-green text-black"
                          : "border border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {d.department} ({d.count})
                    </button>
                  ))}
                </div>
              ) : departments ? (
                <p className="text-xs text-muted">No movie credits found for this person.</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || (type === "CREW" && (!selectedPerson || !department))}
          className="rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add challenge"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetCrewFields();
          }}
          className="text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
