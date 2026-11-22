"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { FilmPicker } from "@/components/FilmPicker";
import { useToast } from "@/components/Toast";
import type { PickedFilm } from "@/lib/challenges";

/** Lets the owner of a hand-picked challenge add and remove its films. */
export function EditChallengeFilmsButton({
  challengeId,
  films: initialFilms,
}: {
  challengeId: string;
  films: PickedFilm[];
}) {
  const router = useRouter();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [films, setFilms] = useState(initialFilms);
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setFilms(initialFilms);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    let res: Response;
    try {
      res = await fetch(`/api/challenges/${challengeId}/films`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ films }),
      });
    } catch {
      setSaving(false);
      showToast("Couldn't save the films. Try again.", "error");
      return;
    }
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      showToast(body?.error ?? "Couldn't save the films", "error");
      return;
    }
    showToast("Films updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={openDialog} className="btn btn-secondary">
        <Pencil aria-hidden className="h-4 w-4" />
        Edit films
      </button>
      {open && (
        <Dialog title="Edit films" onClose={() => setOpen(false)} size="md">
          <div className="space-y-5">
            <FilmPicker films={films} onChange={setFilms} />
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || films.length === 0}
                className="btn btn-primary"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
