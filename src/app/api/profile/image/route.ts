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

type ImageType = "avatar" | "background";

function folderFor(type: ImageType) {
  return type === "avatar" ? "avatars" : "backgrounds";
}

async function clearExisting(dir: string, userId: string) {
  const files = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    files
      .filter((f) => f.startsWith(`${userId}-`))
      .map((f) => unlink(path.join(dir, f)).catch(() => null))
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (type !== "avatar" && type !== "background") {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
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

  const dir = path.join(process.cwd(), "public", "uploads", folderFor(type));
  await mkdir(dir, { recursive: true });
  await clearExisting(dir, session.user.id);

  // The timestamp is baked into the filename (not a query string) so a
  // fresh upload gets a brand-new path — Next.js 16 requires local image
  // query strings to be pre-registered exactly in next.config, which won't
  // work for a value that's different on every upload.
  const filename = `${session.user.id}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  const publicPath = `/uploads/${folderFor(type)}/${filename}`;

  await prisma.user.update({
    where: { id: session.user.id },
    data: type === "avatar" ? { image: publicPath } : { backgroundImage: publicPath },
  });

  return NextResponse.json({ path: publicPath });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type");
  if (type !== "avatar" && type !== "background") {
    return NextResponse.json({ error: "Invalid image type" }, { status: 400 });
  }

  const dir = path.join(process.cwd(), "public", "uploads", folderFor(type));
  await clearExisting(dir, session.user.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: type === "avatar" ? { image: null } : { backgroundImage: null },
  });

  return NextResponse.json({ ok: true });
}
