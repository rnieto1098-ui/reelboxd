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

type ImageType = "avatar" | "background";

function folderFor(type: ImageType) {
  return type === "avatar" ? "avatars" : "backgrounds";
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

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, backgroundImage: true },
  });
  const oldUrl = type === "avatar" ? existing?.image : existing?.backgroundImage;

  // The timestamp is baked into the filename (not a query string) so a
  // fresh upload gets a brand-new path — Next.js 16 requires local image
  // query strings to be pre-registered exactly in next.config, which won't
  // work for a value that's different on every upload.
  const filename = `${folderFor(type)}/${session.user.id}-${Date.now()}.${extension}`;
  // Explicit rather than relying on the SDK's automatic env detection —
  // Vercel now prefers a VERCEL_OIDC_TOKEN over BLOB_READ_WRITE_TOKEN when
  // both are present, so a stale/misconfigured OIDC token could silently
  // shadow a perfectly good read-write token.
  const blob = await put(filename, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: type === "avatar" ? { image: blob.url } : { backgroundImage: blob.url },
  });

  // Delete the old blob only after the new one is safely stored and saved —
  // never risk losing a working image because a later step failed.
  if (oldUrl) await del(oldUrl).catch(() => null);

  return NextResponse.json({ path: blob.url });
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

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, backgroundImage: true },
  });
  const url = type === "avatar" ? existing?.image : existing?.backgroundImage;

  await prisma.user.update({
    where: { id: session.user.id },
    data: type === "avatar" ? { image: null } : { backgroundImage: null },
  });

  if (url) await del(url).catch(() => null);

  return NextResponse.json({ ok: true });
}
