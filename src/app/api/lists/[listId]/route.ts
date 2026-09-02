import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidateListCache } from "@/lib/listCache";

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
