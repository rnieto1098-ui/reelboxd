"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { ListPlusIcon } from "@/components/icons";
import { Dialog } from "@/components/Dialog";

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
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(lists);
  const [newListName, setNewListName] = useState("");
  const [saving, setSaving] = useState(false);

  // `lists` is re-sent after every refresh; adopt it unless a save is in
  // flight (adjusted during render so a stale tick never paints).
  const [prevLists, setPrevLists] = useState(lists);
  if (lists !== prevLists && !saving) {
    setPrevLists(lists);
    setEntries(lists);
  }

  async function toggle(listId: string, currentlyIn: boolean) {
    setSaving(true);

    let res: Response;
    try {
      res = currentlyIn
        ? await fetch(`/api/lists/${listId}/items/${tmdbId}`, { method: "DELETE" })
        : await fetch(`/api/lists/${listId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tmdbId, title, posterPath, releaseDate }),
          });
    } catch {
      setSaving(false);
      showToast("Something went wrong — try again.", "error");
      return;
    }

    setSaving(false);

    // Flipped only on success — this used to flip unconditionally, so a
    // failed request left the checkbox showing a membership that was never
    // actually saved, with nothing to reveal the mismatch until the next
    // full page load.
    if (!res.ok) {
      showToast("Something went wrong — try again.", "error");
      return;
    }

    setEntries((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, hasMovie: !currentlyIn } : l))
    );
    router.refresh();
  }

  async function createAndAdd() {
    if (!newListName.trim()) return;
    setSaving(true);

    let res: Response;
    try {
      res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newListName }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't create that list — try again.", "error");
      return;
    }

    const list = await res.json().catch(() => null);

    if (!res.ok || !list) {
      setSaving(false);
      showToast("Couldn't create that list — try again.", "error");
      return;
    }

    let addRes: Response | null;
    try {
      addRes = await fetch(`/api/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, title, posterPath, releaseDate }),
      });
    } catch {
      addRes = null;
    }

    // The list itself exists either way by this point — only whether this
    // film landed in it is in question, so hasMovie has to reflect that
    // rather than being assumed true. Previously this fetch had no res.ok
    // check at all, so a failed add still showed the film as added.
    setEntries((prev) => [...prev, { id: list.id, title: list.title, hasMovie: !!addRes?.ok }]);
    setNewListName("");
    setSaving(false);

    if (!addRes?.ok) {
      showToast(`Created "${list.title}", but couldn't add this film to it — try again.`, "error");
    }

    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        <ListPlusIcon />
        Add to list
      </button>

      {open && (
        <Dialog title="Add to a list" onClose={() => setOpen(false)} size="sm">
          {entries.length === 0 ? (
            <p className="mb-3 text-sm text-muted">
              You don&apos;t have any lists yet. Name one below to start it with this film.
            </p>
          ) : (
            <ul className="-mx-2 mb-3 max-h-64 overflow-y-auto">
              {entries.map((list) => (
                <li key={list.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={list.hasMovie}
                      disabled={saving}
                      onChange={() => toggle(list.id, list.hasMovie)}
                      className="h-4 w-4 accent-accent-green"
                    />
                    <span className="truncate">{list.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {/* A real form, so Enter in the field creates the list. */}
          <form
            className="flex gap-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              createAndAdd();
            }}
          >
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New list name"
              aria-label="New list name"
              maxLength={100}
              className="input min-w-0 flex-1"
            />
            <button
              type="submit"
              disabled={saving || !newListName.trim()}
              className="btn btn-primary shrink-0"
            >
              Create
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
