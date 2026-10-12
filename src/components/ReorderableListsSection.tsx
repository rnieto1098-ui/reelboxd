"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/Toast";

export type ReorderItem = { id: string; title: string; cover: string | null };

// A Lists-tab section whose lists can be put in a custom order. Normally it
// shows `children` (the usual grid/row); "Reorder" swaps that for a vertical
// list you can drag, or move with the ▲/▼ buttons (keyboard and touch), and
// Save sends the whole order to `endpoint`.
export function ReorderableListsSection({
  title,
  actions,
  endpoint,
  items,
  canReorder = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  endpoint: string;
  items: ReorderItem[];
  canReorder?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState(items);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function start() {
    setOrder(items);
    setEditing(true);
  }

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    let ok = false;
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: order.map((l) => l.id) }),
      });
      ok = res.ok;
    } catch {
      // handled below
    }
    setSaving(false);
    if (!ok) {
      showToast("Couldn't save the new order — try again", "error");
      return;
    }
    setEditing(false);
    showToast("List order saved");
    router.refresh();
  }

  const arrowClass =
    "rounded px-1.5 py-1 text-xs leading-none text-muted transition-colors hover:text-accent-green disabled:opacity-25 disabled:hover:text-muted";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="text-sm text-muted hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-accent-green px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save order"}
              </button>
            </>
          ) : (
            <>
              {canReorder && items.length > 1 && (
                <button
                  type="button"
                  onClick={start}
                  className="text-sm text-muted hover:text-accent-green hover:underline"
                >
                  Reorder
                </button>
              )}
              {actions}
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div>
          <p className="mb-2 text-xs text-muted">
            Drag lists into the order you want, or use the arrows, then save.
          </p>
          <ol className="max-w-xl divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {order.map((list, i) => (
              <li
                key={list.id}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i) {
                    moveTo(dragIndex, i);
                    setDragIndex(i);
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                onDrop={(e) => e.preventDefault()}
                className={`flex cursor-grab items-center gap-3 px-3 py-2 active:cursor-grabbing ${
                  dragIndex === i ? "bg-surface-hover opacity-70" : ""
                }`}
              >
                <span aria-hidden className="select-none text-muted">
                  ⠿
                </span>
                <span className="w-6 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm border border-border bg-background">
                  {list.cover && (
                    <Image src={list.cover} alt="" fill sizes="32px" className="object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{list.title}</span>
                <span className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveTo(i, i - 1)}
                    disabled={i === 0}
                    aria-label={`Move ${list.title} up`}
                    className={arrowClass}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTo(i, i + 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${list.title} down`}
                    className={arrowClass}
                  >
                    ▼
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
