import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalizeEmail";

export const ROLE_ADMIN = "ADMIN";
export const ROLE_USER = "USER";

// Optional override: a comma-separated list of email addresses that are
// always admins, whatever their database role says. Lets the site owner get
// (back) into /admin from the hosting dashboard if no admin account is left.
function envAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map(normalizeEmail)
  );
}

export function hasAdminRole(user: { role: string; email: string }): boolean {
  return user.role === ROLE_ADMIN || envAdminEmails().has(normalizeEmail(user.email));
}

export type AdminUser = { id: string; username: string; email: string };

/**
 * The signed-in user if they are an admin, otherwise null.
 *
 * The role is read from the database on every call rather than carried in
 * the session token: a token lives for weeks, and "this person was demoted"
 * has to take effect on their next request, not whenever it expires.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, username: true, email: true, role: true },
  });
  if (!user || !hasAdminRole(user)) return null;
  return { id: user.id, username: user.username, email: user.email };
}

/**
 * For admin pages. Anyone who isn't an admin gets the ordinary 404 page, so
 * the admin area's existence isn't advertised to visitors who guess the URL.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
