"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function SiteSettingsForm({
  initialAnnouncement,
  initialSignupsOpen,
  maxLength,
}: {
  initialAnnouncement: string;
  initialSignupsOpen: boolean;
  maxLength: number;
}) {
  const router = useRouter();
  const showToast = useToast();
  const announcementId = useId();
  const signupsId = useId();
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [signupsOpen, setSignupsOpen] = useState(initialSignupsOpen);
  const [saving, setSaving] = useState(false);

  const changed = announcement !== initialAnnouncement || signupsOpen !== initialSignupsOpen;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcement: announcement.trim(), signupsOpen }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(body?.error ?? "Couldn't save. Try again.", "error");
        return;
      }
      showToast("Site settings saved");
      // The banner and the sign-up page are drawn on the server.
      router.refresh();
    } catch {
      showToast("Couldn't reach the server. Nothing was saved.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label htmlFor={announcementId} className="field-label">
          Announcement banner
        </label>
        <textarea
          id={announcementId}
          rows={2}
          maxLength={maxLength}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Leave empty for no banner"
          aria-describedby={`${announcementId}-hint`}
          className="input resize-y"
        />
        <p id={`${announcementId}-hint`} className="mt-1.5 flex justify-between gap-4 text-xs text-subtle">
          <span>
            Shown in a strip under the header on every page, to everyone. Plain text only.
          </span>
          <span className="shrink-0 tabular-nums">
            {announcement.length}/{maxLength}
          </span>
        </p>
        {announcement.trim() && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-subtle">Preview</p>
            <div className="rounded-lg border border-accent-green/20 bg-accent-green-soft px-4 py-2 text-center text-sm">
              {announcement.trim()}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        <input
          id={signupsId}
          type="checkbox"
          checked={signupsOpen}
          onChange={(e) => setSignupsOpen(e.target.checked)}
          aria-describedby={`${signupsId}-hint`}
          className="mt-1 h-4 w-4 accent-accent-green"
        />
        <div>
          <label htmlFor={signupsId} className="text-sm font-medium">
            Allow new sign-ups
          </label>
          <p id={`${signupsId}-hint`} className="mt-0.5 text-xs text-subtle">
            Turn this off to stop new accounts being created. Existing members can still sign in.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <button type="submit" disabled={saving || !changed} className="btn btn-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {!changed && <span className="text-xs text-subtle">No unsaved changes</span>}
      </div>
    </form>
  );
}
