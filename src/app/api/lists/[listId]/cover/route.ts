import { NextResponse } from "next/server";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const COVERS_DIR = path.join(process.cwd(), "public", "uploads", "list-covers");

async function clearExisting(listId: string) {
  const files = await readdir(COVERS_DIR).catch(() => [] as string[]);
  await Promise.all(
    files
      .filter((f) => f.startsWith(`${listId}-`))
      .map((f) => unlink(path.join(COVERS_DIR, f)).catch(() => null))
  );
}

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

  await mkdir(COVERS_DIR, { recursive: true });
  await clearExisting(listId);

  // Timestamp baked into the filename (not a query string) so a fresh
  // upload gets a brand-new path — same reasoning as profile image uploads.
  const filename = `${listId}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(COVERS_DIR, filename), buffer);

  const publicPath = `/uploads/list-covers/${filename}`;

  await prisma.list.update({ where: { id: listId }, data: { coverImage: publicPath } });

  return NextResponse.json({ path: publicPath });
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

  await clearExisting(listId);
  await prisma.list.update({ where: { id: listId }, data: { coverImage: null } });

  return NextResponse.json({ ok: true });
}
