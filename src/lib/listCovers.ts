import { prisma } from "@/lib/prisma";

/** Batch lookup, same pattern as getCustomPosterMap. */
export async function getPersonalListCoverMap(
  userId: string | undefined,
  listIds: string[]
): Promise<Map<string, string>> {
  if (!userId || listIds.length === 0) return new Map();

  const covers = await prisma.customListCover.findMany({
    where: { userId, listId: { in: listIds } },
    select: { listId: true, imagePath: true },
  });

  return new Map(covers.map((c) => [c.listId, c.imagePath]));
}

export async function getPersonalListCover(
  userId: string | undefined,
  listId: string
): Promise<string | null> {
  if (!userId) return null;

  const cover = await prisma.customListCover.findUnique({
    where: { userId_listId: { userId, listId } },
    select: { imagePath: true },
  });

  return cover?.imagePath ?? null;
}
