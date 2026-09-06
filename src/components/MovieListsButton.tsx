"use client";

import { useState } from "react";
import Link from "next/link";

type ListEntry = { id: string; title: string };

export function MovieListsButton({ lists }: { lists: ListEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        Lists ({lists.length})
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg">
          {lists.length === 0 ? (
            <p className="text-xs text-muted">Not on any of your lists yet.</p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {lists.map((list) => (
                <Link
                  key={list.id}
                  href={`/lists/${list.id}`}
                  onClick={() => setOpen(false)}
                  className="block truncate rounded px-1 py-1 text-sm hover:bg-surface-hover hover:text-accent-green"
                >
                  {list.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
