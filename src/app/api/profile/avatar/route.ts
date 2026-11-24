import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteBlobs } from "@/lib/blob";
import { avatarPresetById } from "@/lib/avatars";

// Picks one of the preset profile pictures. Uploading your own photo goes
// through /api/profile/image instead.
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const preset = typeof body?.id === "string" ? avatarPresetById(body.id) : undefined;
  if (!preset) {
    return NextResponse.json({ error: "Unknown picture" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: preset.src },
  });

  // Switching away from an uploaded photo frees its blob, as the remove
  // button does. deleteBlobs ignores anything that isn't an upload.
  await deleteBlobs(existing?.image);

  return NextResponse.json({ ok: true });
}
