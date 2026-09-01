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

// This is a personal, viewer-only cover — no ownership check, since the
// whole point is letting anyone set their own cover for a list they don't
// own (most usefully the system-curated lists, which have no owner at all).
export async function POST(request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({ where: { id: listId }, select: { id: true } });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
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

  const existing = await prisma.customListCover.findUnique({
    where: { userId_listId: { userId, listId } },
    select: { imagePath: true },
  });

  const filename = `list-covers/${userId}-${listId}-${Date.now()}.${extension}`;
  // Explicit token — see profile/image/route.ts for why.
  const blob = await put(filename, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await prisma.customListCover.upsert({
    where: { userId_listId: { userId, listId } },
    create: { userId, listId, imagePath: blob.url },
    update: { imagePath: blob.url },
  });

  // Delete the old blob only after the new one is safely stored and saved.
  if (existing?.imagePath) await del(existing.imagePath).catch(() => null);

  return NextResponse.json({ path: blob.url });
}

export async function DELETE(_request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;
  const { listId } = await context.params;

  const existing = await prisma.customListCover.findUnique({
    where: { userId_listId: { userId, listId } },
    select: { imagePath: true },
  });
  await prisma.customListCover.deleteMany({ where: { userId, listId } });
  if (existing?.imagePath) await del(existing.imagePath).catch(() => null);

  return NextResponse.json({ ok: true });
}
