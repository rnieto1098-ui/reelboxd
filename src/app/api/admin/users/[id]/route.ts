import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdmin, ROLE_ADMIN, ROLE_USER } from "@/lib/admin";
import { deleteAccount } from "@/lib/accountDeletion";

// Every admin route answers a non-admin with the same 404 the admin pages
// give, so the admin area's existence isn't revealed by probing its API.
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

const roleSchema = z.object({ role: z.enum([ROLE_ADMIN, ROLE_USER]) });

/** Promote a user to admin, or back to a regular user. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return notFound();

  const { id } = await context.params;
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return notFound();

  // Never leave the site with no admin: whoever demoted the last one,
  // themselves included, could not undo it.
  if (target.role === ROLE_ADMIN && parsed.data.role === ROLE_USER) {
    const otherAdmins = await prisma.user.count({ where: { role: ROLE_ADMIN, id: { not: id } } });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "This is the only admin. Make someone else an admin first." },
        { status: 409 }
      );
    }
  }

  await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
  return NextResponse.json({ ok: true, role: parsed.data.role });
}

/** Permanently delete a user's account and everything on it. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return notFound();

  const { id } = await context.params;
  // Deleting your own account is a deliberate act with its own confirmation
  // (password and all) in Settings, not a row action here.
  if (id === admin.id) {
    return NextResponse.json(
      { error: "To delete your own account, use Settings." },
      { status: 400 }
    );
  }

  const result = await deleteAccount(id);
  if (!result.ok) {
    if (result.reason === "not-found") return notFound();
    return NextResponse.json(
      { error: "That's the only admin account. Make someone else an admin first." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
