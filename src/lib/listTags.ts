// List.tags is a comma-separated string (see prisma/schema.prisma) — these
// keep the parsing/formatting/dedup rules in one place rather than repeated
// at every call site.

// Trims, drops empties, and dedupes case-insensitively (keeping the first
// casing seen) — used both for the raw comma-separated user input on
// create/edit and for values already pulled apart by splitting stored text.
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of rawTags) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function parseTagsInput(input: string): string[] {
  return normalizeTags(input.split(","));
}

export function parseStoredTags(stored: string | null): string[] {
  if (!stored) return [];
  return normalizeTags(stored.split(","));
}

export function tagsToStorageString(tags: string[]): string | null {
  const normalized = normalizeTags(tags);
  return normalized.length > 0 ? normalized.join(", ") : null;
}
