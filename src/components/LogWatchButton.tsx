"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronDown } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Dialog } from "@/components/Dialog";
import { localDateString } from "@/lib/dates";
import { loginHref } from "@/lib/loginHref";

/**
 * Logs a watch in the diary. The main button logs it for today in one
 * click; the arrow beside it opens a date picker for a film watched on
 * another day (the diary API always accepted a date, but nothing in the UI
 * could send one).
 *
 * "Today" is the viewer's own calendar date, sent explicitly. Left to the
 * server it was the UTC date, which is already tomorrow for an evening
 * viewer in the Americas.
 */
export function LogWatchButton({ tmdbId, signedIn }: { tmdbId: number; signedIn: boolean }) {
  const router = useRouter();
  const showToast = useToast();
  const dateFieldId = useId();
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [date, setDate] = useState("");

  async function log(watchedDate: string): Promise<boolean> {
    if (!signedIn) {
      router.push(loginHref());
      return false;
    }
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, watchedDate }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't log that watch — try again.", "error");
      return false;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    if (res.status === 401) {
      router.push(loginHref());
      return false;
    }
    if (!res.ok) {
      showToast(body?.error ?? "Couldn't log that watch — try again.", "error");
      return false;
    }

    const isToday = watchedDate === localDateString();
    if (body?.alreadyLogged) {
      showToast(isToday ? "Already logged today" : "Already logged on that day");
      router.refresh();
      return true;
    }
    showToast(isToday ? "Logged as watched today" : `Logged for ${formatDate(watchedDate)}`);
    for (const challenge of body?.completedChallenges ?? []) {
      showToast(`Challenge complete: ${challenge.title}`);
    }
    if (body?.completedGoal) {
      showToast(`${body.completedGoal.year} watch goal complete!`);
    }
    router.refresh();
    return true;
  }

  function openPicker() {
    if (!signedIn) {
      router.push(loginHref());
      return;
    }
    setDate(localDateString());
    setPickerOpen(true);
  }

  return (
    <>
      <div className="inline-flex">
        <button
          type="button"
          onClick={() => log(localDateString())}
          disabled={saving}
          className="btn btn-secondary rounded-r-none border-r-0"
        >
          <CalendarCheck aria-hidden className="h-4 w-4" />
          {saving && !pickerOpen ? "Logging…" : "Log watch"}
        </button>
        <button
          type="button"
          onClick={openPicker}
          disabled={saving}
          aria-label="Log a watch on another date"
          title="Log a watch on another date"
          className="btn btn-secondary rounded-l-none px-2"
        >
          <ChevronDown aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {pickerOpen && (
        <Dialog title="Log a watch" onClose={() => setPickerOpen(false)} size="sm">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await log(date)) setPickerOpen(false);
            }}
          >
            <label htmlFor={dateFieldId} className="field-label">
              When did you watch it?
            </label>
            <input
              id={dateFieldId}
              type="date"
              required
              value={date}
              max={localDateString()}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
            <p className="mt-2 text-xs text-muted">
              It goes in your diary on that day and counts toward that year&apos;s goal.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPickerOpen(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving || !date} className="btn btn-primary">
                {saving ? "Saving…" : "Save to diary"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

// "2026-11-14" -> "Nov 14, 2026", without letting a timezone shift the day.
function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
