"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

// The viewer's rewatch-list tmdbIds, loaded once by the root layout so every
// poster's hover button knows its state without each page threading a set of
// ids down through its rows and grids (the way watchlist state is). The
// layout re-renders on router.refresh(), which every toggle triggers, so this
// stays current.
const RewatchIdsContext = createContext<ReadonlySet<number>>(new Set());

export function RewatchIdsProvider({ ids, children }: { ids: number[]; children: ReactNode }) {
  const set = useMemo(() => new Set(ids), [ids]);
  return <RewatchIdsContext.Provider value={set}>{children}</RewatchIdsContext.Provider>;
}

export function useRewatchIds(): ReadonlySet<number> {
  return useContext(RewatchIdsContext);
}
