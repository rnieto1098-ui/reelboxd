import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// One shared tag for every cached list — coarser than per-list tags (a
// write to any list bumps everyone's cache), but simple and correct, and
// fine at this app's scale. System lists (isSystem: true) are never
// mutated through the app at all — every list-mutation route rejects them
// — so this is pure upside for the curated lists (Letterboxd Top 500,
// IMDb Top 250, ...) that get the most repeat traffic; user-owned lists
// just get revalidated on every write via revalidateListCache() below.
export const LIST_CACHE_TAG = "lists";

// The one non-personalized, expensive-ish part of a list detail page (can
// be hundreds of items) — everything else (ratings, posters, ownership,
// personal cover) is per-viewer and stays uncached.
export const getCachedList = unstable_cache(
  (listId: string) =>
    prisma.list.findUnique({
      where: { id: listId },
      include: {
        owner: { select: { username: true } },
        items: { orderBy: { position: "asc" } },
      },
    }),
  ["list-detail"],
  { revalidate: 3600, tags: [LIST_CACHE_TAG] }
);

export function revalidateListCache() {
  // { expire: 0 } = bust it now. updateTag would give stronger read-your-
  // own-writes guarantees but only works inside Server Actions — these
  // callers are plain Route Handlers (fetch-based mutations from client
  // components), so revalidateTag is what's available here.
  revalidateTag(LIST_CACHE_TAG, { expire: 0 });
}
