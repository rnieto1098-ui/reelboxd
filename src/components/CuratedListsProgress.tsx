"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import type { ListProgress } from "@/lib/systemLists";
import { ProgressBar } from "@/components/Progress";

// Local reorder + best-effort persist, same pattern as everywhere else in
// the app that saves a preference in the background (e.g. streaming service
// toggles) — the UI never blocks on the save, it just quietly retries by
// letting the next reorder resend the whole list if this one fails.
export function CuratedListsProgress({ lists }: { lists: ListProgress[] }) {
  // Only the *order* is state. The cards themselves always come from the
  // latest `lists` prop: holding the list objects here pinned the numbers
  // from the first render, so marking a film watched refreshed the page but
  // left every progress bar showing its old percentage.
  const [orderIds, setOrderIds] = useState(() => lists.map((l) => l.id));
  const showToast = useToast();
  const byId = new Map(lists.map((l) => [l.id, l]));
  const order = [
    ...orderIds.map((id) => byId.get(id)).filter((l): l is ListProgress => l !== undefined),
    // Anything new since the order was last set goes at the end.
    ...lists.filter((l) => !orderIds.includes(l.id)),
  ];

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;

    const previous = order.map((l) => l.id);
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrderIds(next.map((l) => l.id));

    // Checking res.ok matters as much as the catch: fetch only rejects on a
    // network failure, so a 401/500 used to resolve normally and this
    // reported success it hadn't had. On either kind of failure the local
    // order is put back, so what's on screen still matches what's saved.
    fetch("/api/account/curated-list-order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((l) => l.id) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("save failed");
      })
      .catch(() => {
        setOrderIds(previous);
        showToast("Couldn't save the new order — try again", "error");
      });
  }

  return (
    <section>
      <h2 className="section-title mb-4">Your list progress</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {order.map((list, i) => (
          <div
            key={list.id}
            className="card relative p-4 transition-colors hover:border-border-strong"
          >
            <Link href={`/lists/${list.id}`} className="block">
              <div className="mb-1.5 flex items-center justify-between gap-2 pr-12 text-sm">
                <span className="truncate font-medium">{list.title}</span>
                <span className="shrink-0 text-muted">{list.percent}%</span>
              </div>
              <ProgressBar percent={list.percent} label={`${list.title} progress`} />
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
                className="flex h-8 w-7 items-center justify-center rounded-md text-xs leading-none text-muted transition-colors hover:bg-white/[0.07] hover:text-accent-green disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${list.title} down`}
                className="flex h-8 w-7 items-center justify-center rounded-md text-xs leading-none text-muted transition-colors hover:bg-white/[0.07] hover:text-accent-green disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted"
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
