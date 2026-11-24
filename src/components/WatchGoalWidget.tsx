"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Target, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { ProgressBar, ProgressRing } from "@/components/Progress";
import { ChallengeBadge } from "@/components/ChallengeBadge";

const MAX_TARGET = 2000;

export function WatchGoalWidget({
  year,
  target,
  count,
  percent,
  pace = null,
  isOwner,
  username,
}: {
  year: number;
  target: number | null;
  count: number;
  percent: number | null;
  // "12 to go, 3 ahead of pace…": worked out on the server (see goals.ts).
  pace?: string | null;
  isOwner: boolean;
  username: string;
}) {
  const router = useRouter();
  const showToast = useToast();
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [value, setValue] = useState(target ? String(target) : "50");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(value);
    // Say why nothing happened. An out-of-range number used to make the
    // Save button do nothing at all, with no message.
    if (!Number.isInteger(n) || n < 1 || n > MAX_TARGET) {
      setError(`Enter a whole number from 1 to ${MAX_TARGET}.`);
      return;
    }
    setError(null);
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, target: n }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't save that goal — try again.", "error");
      return;
    }

    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't save that goal — try again.", "error");
      return;
    }

    setEditing(false);
    showToast(`${year} goal set to ${n} films`);
    router.refresh();
  }

  async function remove() {
    setSaving(true);

    let res: Response;
    try {
      res = await fetch(`/api/goals?year=${year}`, { method: "DELETE" });
    } catch {
      setSaving(false);
      showToast("Couldn't remove that goal — try again.", "error");
      return;
    }

    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't remove that goal — try again.", "error");
      return;
    }

    setConfirmingRemove(false);
    showToast("Goal removed");
    router.refresh();
  }

  const editor = (
    <form
      className="flex flex-wrap items-center gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={inputId} className="text-muted">
        Watch
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_TARGET}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!!error}
        className="input w-24 text-center"
      />
      <span className="text-muted">films in {year}</span>
      <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
        {saving ? "Saving…" : "Save goal"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        className="btn btn-ghost btn-sm"
      >
        Cancel
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );

  if (target == null && !isOwner) return null;

  if (target == null) {
    return editing ? (
      <div className="card p-5">{editor}</div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-4 rounded-[0.875rem] border border-dashed border-border-strong p-5 text-left transition-colors hover:border-accent-green hover:bg-accent-green-soft"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-green-soft text-accent-green">
          <Target aria-hidden className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-semibold">Set a watch goal for {year}</span>
          <span className="block text-sm text-muted">
            Pick a number of films and track your pace through the year.
          </span>
        </span>
      </button>
    );
  }

  const diaryHref = `/profile/${username}/diary?year=${year}`;
  const reached = percent != null && percent >= 100;

  return (
    <section
      aria-label={`${year} watch goal`}
      className={`card p-5 ${reached ? "border-accent-green/45 bg-gradient-to-br from-accent-green-soft to-surface" : ""}`}
    >
      <div className="flex items-center gap-4 sm:gap-5">
        {reached ? (
          <ChallengeBadge kind="GOAL" size={72} label="Watch goal reached" />
        ) : (
          <ProgressRing percent={percent} size={72} stroke={6} />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle">
            {year} watch goal
          </p>
          <Link href={diaryHref} className="group inline-block">
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight group-hover:text-accent-green">
              {count} <span className="text-base font-medium text-muted">of {target} films</span>
            </p>
          </Link>
          {pace && <p className="mt-0.5 text-sm text-muted">{pace}</p>}
        </div>

        {isOwner && !editing && (
          <div className="flex shrink-0 items-center gap-1 self-start">
            {/* Two-step: deleting a year's goal used to be one misclick with
                nothing to undo it. */}
            {confirmingRemove ? (
              <>
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className="btn btn-danger btn-sm"
                >
                  {saving ? "Removing…" : "Remove goal"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Change ${year} goal`}
                  title="Change goal"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.07] hover:text-foreground"
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  aria-label={`Remove ${year} goal`}
                  title="Remove goal"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 border-t border-border pt-4">{editor}</div>
      ) : (
        <div className="mt-4">
          <ProgressBar percent={percent} label={`${year} watch goal`} className="h-2.5" />
        </div>
      )}
    </section>
  );
}
