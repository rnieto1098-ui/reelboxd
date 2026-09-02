import { NextResponse } from "next/server";
import { z } from "zod";
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

  // Same one-per-day rule createDiaryEntry enforces on create — moving this
  // entry's date onto a day that already has a log of the same movie would
  // otherwise silently produce the duplicate the rule exists to prevent.
  if (newWatchedDate) {
    const dayStart = new Date(
      Date.UTC(newWatchedDate.getUTCFullYear(), newWatchedDate.getUTCMonth(), newWatchedDate.getUTCDate())
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const conflict = await prisma.diaryEntry.findFirst({
      where: {
        userId: session.user.id,
        movieId: entry.movieId,
        id: { not: entryId },
        watchedDate: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "This movie is already logged on that day." },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      watchedDate: newWatchedDate,
      rewatch: parsed.data.rewatch,
    },
  });

  return NextResponse.json(updated);
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
