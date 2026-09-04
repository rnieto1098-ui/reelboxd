"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { ListProgress } from "@/lib/systemLists";

// Local reorder + best-effort persist, same pattern as everywhere else in
// the app that saves a preference in the background (e.g. streaming service
// toggles) — the UI never blocks on the save, it just quietly retries by
// letting the next reorder resend the whole list if this one fails.
export function CuratedListsProgress({ lists }: { lists: ListProgress[] }) {
  const [order, setOrder] = useState(lists);
  const showToast = useToast();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);

    fetch("/api/account/curated-list-order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((l) => l.id) }),
    }).catch(() => {
      showToast("Couldn't save the new order — try again", "error");
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Your List Progress</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((list, i) => (
          <div
            key={list.id}
            className="relative rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent-green"
          >
            <Link href={`/lists/${list.id}`} className="block">
              <div className="mb-1.5 flex items-center justify-between gap-2 pr-12 text-sm">
                <span className="truncate font-medium">{list.title}</span>
                <span className="shrink-0 text-muted">{list.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-accent-green"
                  style={{ width: `${list.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                {list.watchedCount} / {list.itemCount} watched
              </p>
            </Link>
            {/* Overlay buttons, not nested in the Link above — same reason
                MovieCard's quick actions sit as a sibling over its poster
                Link rather than inside it: a <button> inside an <a> is
                invalid HTML with undefined click behavior. */}
            <div className="absolute right-2 top-2 flex gap-0.5 rounded bg-surface/80">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${list.title} up`}
                className="rounded px-1 py-0.5 text-xs leading-none text-muted transition-colors hover:text-accent-green disabled:opacity-25 disabled:hover:text-muted"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${list.title} down`}
                className="rounded px-1 py-0.5 text-xs leading-none text-muted transition-colors hover:text-accent-green disabled:opacity-25 disabled:hover:text-muted"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
