"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlusIcon } from "@/components/icons";

type ListEntry = { id: string; title: string; hasMovie: boolean };

export function AddToListButton({
  tmdbId,
  title,
  posterPath,
  releaseDate,
  lists,
}: {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string;
  lists: ListEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(lists);
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);

  async function toggle(listId: string, currentlyIn: boolean) {
    setSaving(true);
    if (currentlyIn) {
      await fetch(`/api/lists/${listId}/items/${tmdbId}`, { method: "DELETE" });
    } else {
      await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, title, posterPath, releaseDate }),
      });
    }
    setEntries((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, hasMovie: !currentlyIn } : l))
    );
    setSaving(false);
    router.refresh();
  }

  async function createAndAdd() {
    if (!newListName.trim()) return;
    setSaving(true);

    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newListName }),
    });
    const list = await res.json();

    if (res.ok) {
      await fetch(`/api/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, title, posterPath, releaseDate }),
      });
      setEntries((prev) => [...prev, { id: list.id, title: list.title, hasMovie: true }]);
      setNewListName("");
    }

    setSaving(false);
    router.refresh();
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium border-border text-muted hover:text-foreground transition-colors"
      >
        <ListPlusIcon />
        Add to list
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
          {entries.length === 0 ? (
            <p className="mb-2 text-xs text-muted">You don&apos;t have any lists yet.</p>
          ) : (
            <div className="mb-2 max-h-48 space-y-1 overflow-y-auto">
              {entries.map((list) => (
                <label
                  key={list.id}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-surface-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={list.hasMovie}
                    disabled={saving}
                    onChange={() => toggle(list.id, list.hasMovie)}
                    className="accent-accent-green"
                  />
                  <span className="truncate">{list.title}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-1.5 border-t border-border pt-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New list name"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs placeholder:text-muted focus:outline-none focus:border-accent-green"
            />
            <button
              type="button"
              onClick={createAndAdd}
              disabled={saving || !newListName.trim()}
              className="shrink-0 rounded-md bg-accent-green px-2 py-1 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
