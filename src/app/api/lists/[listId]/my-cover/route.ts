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

async function clearExisting(prefix: string) {
  const files = await readdir(COVERS_DIR).catch(() => [] as string[]);
  await Promise.all(
    files
      .filter((f) => f.startsWith(`${prefix}-`))
      .map((f) => unlink(path.join(COVERS_DIR, f)).catch(() => null))
  );
}

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

  await mkdir(COVERS_DIR, { recursive: true });
  const prefix = `${userId}-${listId}`;
  await clearExisting(prefix);

  const filename = `${prefix}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(COVERS_DIR, filename), buffer);

  const publicPath = `/uploads/list-covers/${filename}`;

  await prisma.customListCover.upsert({
    where: { userId_listId: { userId, listId } },
    create: { userId, listId, imagePath: publicPath },
    update: { imagePath: publicPath },
  });

  return NextResponse.json({ path: publicPath });
}

export async function DELETE(_request: Request, context: { params: Promise<{ listId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;
  const { listId } = await context.params;

  await clearExisting(`${userId}-${listId}`);
  await prisma.customListCover.deleteMany({ where: { userId, listId } });

  return NextResponse.json({ ok: true });
}
