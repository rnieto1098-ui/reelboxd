"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function RandomChallengeButton() {
  const router = useRouter();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);

  async function generate() {
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/challenges/random", { method: "POST" });
    } catch {
      // res.json().catch() below only guarded the body parse — a thrown
      // fetch itself skipped setSaving(false) entirely, leaving the button
      // stuck on "Rolling..." until the page was reloaded.
      setSaving(false);
      showToast("Couldn't generate a challenge — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(body?.error ?? "Couldn't generate a challenge — try again.", "error");
      return;
    }

    showToast(`🎲 ${body.title}`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={saving}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors disabled:opacity-50"
    >
      {saving ? "Rolling..." : "🎲 Random challenge"}
    </button>
  );
}
