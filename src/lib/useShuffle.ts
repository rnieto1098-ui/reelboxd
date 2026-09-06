"use client";

import { useState } from "react";
import { fisherYatesShuffle } from "@/lib/shuffle";

// Shared by every shufflable row/grid in the app (watchlist, list detail,
// crew credits, homepage rows, ...) so the "reorder in place, reset when the
// underlying data actually changes" behavior — and the shuffle algorithm
// itself — can't drift between them.
//
// getKey has to identify an item across renders. Comparing array identity
// instead looks equivalent but isn't: a server component builds a brand-new
// array every time it renders, so *any* router.refresh() counted as "the
// data changed" and threw the shuffle away — including the refresh
// PosterQuickActions fires after every owned/watchlist/log click, which made
// a shuffled row snap back to server order on the next poster click.
export function useShuffle<T>(items: T[], getKey: (item: T) => string | number) {
  // The shuffle is stored as keys rather than the items themselves so the
  // rendered objects are always the ones the server just sent. Holding the
  // items would pin whatever was on screen when the shuffle happened and
  // show stale data after a refresh.
  const [shuffledKeys, setShuffledKeys] = useState<(string | number)[] | null>(null);

  const signature = items.map(getKey).join(",");
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setShuffledKeys(null);
  }

  let order = items;
  if (shuffledKeys) {
    const byKey = new Map(items.map((item) => [getKey(item), item]));
    order = shuffledKeys
      .map((key) => byKey.get(key))
      .filter((item): item is T => item !== undefined);
  }

  return {
    order,
    shuffle: () => setShuffledKeys(fisherYatesShuffle(items).map(getKey)),
  };
}
