"use client";

import { useState } from "react";
import { fisherYatesShuffle } from "@/lib/shuffle";

// Shared by every shufflable row/grid in the app (watchlist, list detail,
// crew credits, homepage rows, ...) so the "reorder in place, reset when the
// underlying data actually changes" behavior — and the shuffle algorithm
// itself — can't drift between them.
export function useShuffle<T>(items: T[]) {
  const [order, setOrder] = useState(items);
  // items is a new array reference whenever the underlying data actually
  // changes (a different sort/filter/page) — reset to it instead of
  // carrying a stale shuffle across that change.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setOrder(items);
  }

  return {
    order,
    shuffle: () => setOrder(fisherYatesShuffle(items)),
  };
}
