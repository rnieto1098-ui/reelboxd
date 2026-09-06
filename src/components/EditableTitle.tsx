"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

// Rename-in-place for anything the owner titled themselves. Shared by
// challenge cards and list pages rather than written twice, since the only
// things that actually differ are the endpoint it PATCHes, whether the
// title doubles as a link, and how big the text is.
export function EditableTitle({
  endpoint,
  title,
  href,
  canEdit,
  className = "text-sm font-semibold",
}: {
  /** PATCH target; receives `{ title }`. */
  endpoint: string;
  title: string;
  href?: string;
  canEdit: boolean;
  className?: string;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);

  // The title can change under us after a router.refresh() — adjust during
  // render, the same way PosterQuickActions handles its own props.
  const [prevTitle, setPrevTitle] = useState(title);
  if (title !== prevTitle) {
    setPrevTitle(title);
    setValue(title);
  }

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
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't rename that — try again.", "error");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  const text = href ? (
    <Link href={href} className={`block truncate hover:text-accent-green hover:underline ${className}`}>
      {title}
    </Link>
  ) : (
    <span className={`block truncate ${className}`}>{title}</span>
  );

  if (!canEdit) return text;

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
          className={`min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 focus:border-accent-green focus:outline-none disabled:opacity-50 ${className}`}
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
      {text}
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
