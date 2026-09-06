import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateListCache } from "@/lib/listCache";
import { parseTagsInput, tagsToStorageString } from "@/lib/listTags";

// Both optional so one endpoint covers the tag editor and the rename
// control without either having to send the other's field.
const updateListSchema = z
  .object({
    tags: z.string().max(300).optional(),
    title: z.string().trim().min(1, "Give your list a name").max(100).optional(),
  })
  .refine((v) => v.tags !== undefined || v.title !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({ where: { id: listId } });

  if (!list || list.isSystem || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid update" },
      { status: 400 }
    );
  }

  const updated = await prisma.list.update({
    where: { id: listId },
    data: {
      ...(parsed.data.tags !== undefined
        ? { tags: tagsToStorageString(parseTagsInput(parsed.data.tags)) }
        : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    },
  });
  revalidateListCache();

  return NextResponse.json({ tags: updated.tags, title: updated.title });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({ where: { id: listId } });

  if (!list || list.isSystem || list.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.list.delete({ where: { id: listId } });
  revalidateListCache();

  return NextResponse.json({ ok: true });
}
