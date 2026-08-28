"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "@/components/icons";

export function LogWatchButton({ tmdbId, signedIn }: { tmdbId: number; signedIn: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function logToday() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setSaving(true);
    await fetch("/api/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId }),
    });
    setSaving(false);
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
