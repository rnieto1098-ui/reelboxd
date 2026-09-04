import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  watchedDate: z.string().optional(),
  rewatch: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { entryId } = await context.params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid entry" },
      { status: 400 }
    );
  }

  const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newWatchedDate = parsed.data.watchedDate ? new Date(parsed.data.watchedDate) : undefined;
  const newWatchedDay = newWatchedDate
    ? new Date(
        Date.UTC(newWatchedDate.getUTCFullYear(), newWatchedDate.getUTCMonth(), newWatchedDate.getUTCDate())
      )
    : undefined;

  // Same one-per-day rule createDiaryEntry enforces on create — moving this
  // entry's date onto a day that already has a log of the same movie would
  // otherwise silently produce the duplicate the rule exists to prevent.
  // The @@unique([userId, movieId, watchedDay]) constraint is the real
  // guarantee (closes the race a plain pre-check alone would leave open);
  // this update just surfaces that as a friendly 409 instead of a 500.
  try {
    const updated = await prisma.diaryEntry.update({
      where: { id: entryId },
      data: {
        watchedDate: newWatchedDate,
        watchedDay: newWatchedDay,
        rewatch: parsed.data.rewatch,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This movie is already logged on that day." },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { entryId } = await context.params;
  const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ ok: true });
  }

  await prisma.diaryEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
