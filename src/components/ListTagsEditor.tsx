"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function ListTagsEditor({
  listId,
  initialTags,
  isOwner,
}: {
  listId: string;
  initialTags: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTags.join(", "));
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: value }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast(body?.error ?? "Couldn't save tags", "error");
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!isOwner && initialTags.length === 0) return null;

  if (editing) {
    return (
      <form onSubmit={save} className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Tags, comma separated"
          className="w-64 rounded-md border border-border bg-background px-2.5 py-1 text-xs placeholder:text-muted focus:outline-none focus:border-accent-green"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent-green px-2.5 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(initialTags.join(", "));
            setEditing(false);
          }}
          className="text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {initialTags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-muted"
        >
          {tag}
        </span>
      ))}
      {isOwner && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-muted hover:text-accent-green hover:underline"
        >
          {initialTags.length > 0 ? "Edit tags" : "+ Add tags"}
        </button>
      )}
    </div>
  );
}
