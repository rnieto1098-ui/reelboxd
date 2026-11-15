"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dices } from "lucide-react";
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

    showToast(`New challenge: ${body.title}`);
    router.refresh();
  }

  return (
    <button type="button" onClick={generate} disabled={saving} className="btn btn-secondary">
      <Dices aria-hidden className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
      {saving ? "Rolling…" : "Surprise me"}
    </button>
  );
}
