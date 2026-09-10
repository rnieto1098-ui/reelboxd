import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { username } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  // Not atomic with the check above: two users can both clear it while
  // claiming the same free username, and the loser hits User.username's
  // @unique constraint. Catching P2002 turns that into the same 409 the
  // check itself would have returned, rather than an uncaught 500.
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { username },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
