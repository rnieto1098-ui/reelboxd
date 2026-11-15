import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * "Sign out everywhere": ends every session on the account, this one
 * included. Sign-in tokens can't be recalled individually, so this moves the
 * account's cut-off time to now and every token issued before it is refused
 * from the next request on (see the jwt callback in auth.ts).
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionsValidFrom: new Date() },
  });

  return NextResponse.json({ ok: true });
}
