"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WatchGoalWidget({
  year,
  target,
  count,
  percent,
  isOwner,
}: {
  year: number;
  target: number | null;
  count: number;
  percent: number | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(target ? String(target) : "50");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) return;
    setSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, target: Math.round(n) }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    await fetch(`/api/goals?year=${year}`, { method: "DELETE" });
    setSaving(false);
    router.refresh();
  }

  if (target == null && !isOwner) return null;

  if (target == null) {
    return editing ? (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <span className="text-muted">Watch</span>
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center focus:outline-none focus:border-accent-green"
        />
        <span className="text-muted">films in {year}</span>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="ml-2 rounded-md bg-accent-green px-3 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg border border-dashed border-border p-4 text-left text-sm text-muted transition-colors hover:border-accent-green hover:text-foreground"
      >
        + Set a watch goal for {year}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {year} Challenge: {count} / {target} films
        </p>
        {isOwner &&
          (editing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-xs focus:outline-none focus:border-accent-green"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-accent-green px-2 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-muted hover:text-foreground"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="text-muted hover:text-red-400 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-accent-green transition-all"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {percent != null && percent >= 100
          ? "Goal reached! 🎉"
          : `${percent ?? 0}% of the way there`}
      </p>
    </div>
  );
}
