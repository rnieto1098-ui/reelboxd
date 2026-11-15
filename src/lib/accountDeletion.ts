import { deleteBlobs } from "@/lib/blob";
import { prisma } from "@/lib/prisma";
import { isUploadedBackground } from "@/lib/backgrounds";
import { ROLE_ADMIN } from "@/lib/admin";

export type DeleteAccountResult = { ok: true } | { ok: false; reason: "not-found" | "last-admin" };

/**
 * Permanently deletes a user and everything that belongs to them.
 *
 * The database does most of the work: every table that references a user
 * does so with `onDelete: Cascade`, so removing the User row removes their
 * ratings, diary, watchlist, lists, challenges and the rest in one step.
 * What it can't reach are the image files they uploaded (avatar, background,
 * list covers), which live in blob storage; those are removed afterwards,
 * best effort. A leftover file is litter, not a reason to fail the deletion.
 *
 * Refuses to delete the last admin, since that would leave nobody able to
 * open the admin area. Shared by "delete my account" in Settings and
 * "delete user" in the admin area so both follow the same rules.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      image: true,
      backgroundImage: true,
      lists: { select: { coverImage: true } },
      customListCovers: { select: { imagePath: true } },
    },
  });
  if (!user) return { ok: false, reason: "not-found" };

  if (user.role === ROLE_ADMIN) {
    const otherAdmins = await prisma.user.count({
      where: { role: ROLE_ADMIN, id: { not: userId } },
    });
    if (otherAdmins === 0) return { ok: false, reason: "last-admin" };
  }

  // Collected before the delete: afterwards the rows that name them are gone.
  const blobUrls = [
    user.image,
    isUploadedBackground(user.backgroundImage) ? user.backgroundImage : null,
    ...user.lists.map((l) => l.coverImage),
    ...user.customListCovers.map((c) => c.imagePath),
  ];

  await prisma.user.delete({ where: { id: userId } });

  await deleteBlobs(blobUrls);

  return { ok: true };
}
