import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateListCache } from "@/lib/listCache";
import { parseTagsInput, tagsToStorageString } from "@/lib/listTags";

const updateTagsSchema = z.object({
  tags: z.string().max(300),
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
  const parsed = updateTagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid tags" },
      { status: 400 }
    );
  }

  const tags = tagsToStorageString(parseTagsInput(parsed.data.tags));
  await prisma.list.update({ where: { id: listId }, data: { tags } });
  revalidateListCache();

  return NextResponse.json({ tags });
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
