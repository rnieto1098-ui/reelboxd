import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function assertOwnedList(listId: string, userId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId }, select: { ownerId: true } });
  return list?.ownerId === userId;
}

export async function POST(request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  if (!(await assertOwnedList(listId, session.user.id))) {
    return NextResponse.json({ error: "Not your list" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Please upload a PNG, JPEG, WEBP, or GIF image" },
      { status: 400 }
    );
  }

  const existing = await prisma.list.findUnique({ where: { id: listId }, select: { coverImage: true } });

  // Timestamp baked into the filename (not a query string) so a fresh
  // upload gets a brand-new path — same reasoning as profile image uploads.
  const filename = `list-covers/${listId}-${Date.now()}.${extension}`;
  const blob = await put(filename, file, { access: "public" });

  await prisma.list.update({ where: { id: listId }, data: { coverImage: blob.url } });

  // Delete the old blob only after the new one is safely stored and saved.
  if (existing?.coverImage) await del(existing.coverImage).catch(() => null);

  return NextResponse.json({ path: blob.url });
}

export async function DELETE(_request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  if (!(await assertOwnedList(listId, session.user.id))) {
    return NextResponse.json({ error: "Not your list" }, { status: 403 });
  }

  const existing = await prisma.list.findUnique({ where: { id: listId }, select: { coverImage: true } });
  await prisma.list.update({ where: { id: listId }, data: { coverImage: null } });
  if (existing?.coverImage) await del(existing.coverImage).catch(() => null);

  return NextResponse.json({ ok: true });
}
