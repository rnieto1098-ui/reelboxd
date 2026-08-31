export type SortDir = "asc" | "desc";

// Missing values always sort to the end regardless of direction, so
// reversing never buries real data under a pile of unrated/no-runtime-data
// items. desc (highest first): comparator must be negative when va > vb,
// i.e. vb - va. asc flips that. Getting this backwards silently produces
// the opposite order while still "looking like" a working sort — the exact
// bug this was extracted from (it shipped independently in two different
// pages before being caught).
export function compareNullableNumbers(va: number | null, vb: number | null, dir: SortDir): number {
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return dir === "desc" ? vb - va : va - vb;
}
