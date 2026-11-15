"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

// Turns the list you're looking at into a challenge to watch all of it.
// The list-picking is implicit — you're already on the list — which is why
// this lives here rather than as a fourth type in NewChallengeForm.
export function MakeListChallengeButton({ listId }: { listId: string }) {
  const router = useRouter();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);

  async function create() {
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "LIST", listId }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't make that a challenge — try again.", "error");
      return;
    }

    const body = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      showToast(body?.error ?? "Couldn't make that a challenge — try again.", "error");
      return;
    }

    showToast(body?.alreadyExisted ? "Already one of your challenges" : "Challenge added");
    router.push(`/challenges/${body.id}`);
  }

  return (
    <button
      type="button"
      onClick={create}
      disabled={saving}
      className="btn btn-outline btn-sm"
    >
      {saving ? "Adding..." : "Make it a challenge"}
    </button>
  );
}
