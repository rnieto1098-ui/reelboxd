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

  const updated = await prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      watchedDate: parsed.data.watchedDate ? new Date(parsed.data.watchedDate) : undefined,
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
