"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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
  twoLines = false,
}: {
  /** PATCH target; receives `{ title }`. */
  endpoint: string;
  title: string;
  href?: string;
  canEdit: boolean;
  className?: string;
  /** Wrap onto a second line before clipping, instead of one-line truncation. */
  twoLines?: boolean;
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

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't rename that — try again.", "error");
      return;
    }

    setSaving(false);

    if (!res.ok) {
      showToast("Couldn't rename that — try again.", "error");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  // title= gives the full text as a tooltip whenever it gets clipped.
  // line-clamp sets its own display, so it must not be paired with `block`.
  const clip = twoLines ? "line-clamp-2 break-words" : "block truncate";
  const text = href ? (
    <Link
      href={href}
      title={title}
      className={`${clip} hover:text-accent-green hover:underline ${className}`}
    >
      {title}
    </Link>
  ) : (
    <span title={title} className={`${clip} ${className}`}>
      {title}
    </span>
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
          aria-label="Title"
          className={`input min-w-0 flex-1 py-1 disabled:opacity-50 ${className}`}
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn btn-primary btn-sm shrink-0"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="btn btn-ghost btn-sm shrink-0"
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
        aria-label={`Rename "${title}"`}
        title="Rename"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-white/[0.07] hover:text-foreground"
      >
        <Pencil aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
