"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function EditableChallengeTitle({
  challengeId,
  title,
  href,
}: {
  challengeId: string;
  title: string;
  href: string;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);

  function cancel() {
    setEditing(false);
    setValue(title);
  }

  async function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      cancel();
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/challenges/${challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't rename that challenge — try again.", "error");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          maxLength={100}
          disabled={saving}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:border-accent-green disabled:opacity-50"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="shrink-0 text-xs text-accent-green hover:underline disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="shrink-0 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={href}
        className="block truncate text-sm font-semibold hover:text-accent-green hover:underline"
      >
        {title}
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-xs text-muted hover:text-foreground"
      >
        Edit
      </button>
    </div>
  );
}
