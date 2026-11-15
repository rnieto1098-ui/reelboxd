"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Dialog } from "@/components/Dialog";

type ListEntry = { id: string; title: string; isSystem: boolean };

// Which lists this film appears on: Flixtally's curated ones plus the
// viewer's own.
export function MovieListsButton({ lists }: { lists: ListEntry[] }) {
  const [open, setOpen] = useState(false);

  if (lists.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
        <ListChecks aria-hidden className="h-4 w-4" />
        On {lists.length} list{lists.length === 1 ? "" : "s"}
      </button>

      {open && (
        <Dialog title="Lists featuring this film" onClose={() => setOpen(false)} size="sm">
          <ul className="-mx-2">
            {lists.map((list) => (
              <li key={list.id}>
                <Link
                  href={`/lists/${list.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/[0.06] hover:text-accent-green"
                >
                  <span className="truncate">{list.title}</span>
                  {list.isSystem && <span className="chip shrink-0 py-0.5 text-[10px]">Curated</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
