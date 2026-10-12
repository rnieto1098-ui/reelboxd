// Saved list orders (User.listOrder, User.curatedListOrder) are stored as a
// comma-separated string of List ids, most-preferred first.

export function parseListOrder(raw: string | null | undefined): string[] {
  return raw ? raw.split(",").filter(Boolean) : [];
}

// Sorts `items` by a saved id order. Items the saved order doesn't mention
// (a list created or added since the last reorder) keep their incoming
// relative order and go before or after the placed ones; saved ids that no
// longer exist (a deleted list) are simply skipped.
export function applySavedOrder<T extends { id: string }>(
  items: T[],
  savedIds: string[],
  unplaced: "start" | "end"
): T[] {
  if (savedIds.length === 0) return items;
  const position = new Map(savedIds.map((id, i) => [id, i]));
  const placed = items
    .filter((item) => position.has(item.id))
    .sort((a, b) => position.get(a.id)! - position.get(b.id)!);
  const rest = items.filter((item) => !position.has(item.id));
  return unplaced === "start" ? [...rest, ...placed] : [...placed, ...rest];
}
