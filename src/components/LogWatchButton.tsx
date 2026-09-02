"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";

export function LogWatchButton({ tmdbId, signedIn }: { tmdbId: number; signedIn: boolean }) {
  const router = useRouter();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);

  async function logToday() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId }),
    });
    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't log that watch — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    if (body?.alreadyLogged) {
      showToast("Already logged today");
      router.refresh();
      return;
    }
    showToast("Logged as watched today");
    for (const challenge of body?.completedChallenges ?? []) {
      showToast(`🎉 Challenge complete: ${challenge.title}`);
    }
    if (body?.completedGoal) {
      showToast(`🎉 ${body.completedGoal.year} watch goal complete!`);
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logToday}
      disabled={saving}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
    >
      <CalendarIcon />
      Log watch
    </button>
  );
}
