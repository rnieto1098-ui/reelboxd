import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteAccount } from "@/lib/accountDeletion";

const deleteSchema = z.object({
  // Deleting an account can't be undone, so it takes the password again: a
  // session left open on a shared computer isn't enough to do it.
  password: z.string().min(1, "Enter your password to confirm"),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hashedPassword: true },
  });
  if (!user?.hashedPassword) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (!(await bcrypt.compare(parsed.data.password, user.hashedPassword))) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 403 });
  }

  const result = await deleteAccount(session.user.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "last-admin"
            ? "You're the only admin. Make someone else an admin first, then delete this account."
            : "Account not found",
      },
      { status: result.reason === "last-admin" ? 409 : 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
