import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_ID,
  NO_BACKGROUND,
  isUploadedBackground,
  presetValue,
} from "@/lib/backgrounds";

// Picks a preset site background, or "none" for a plain one. Uploading your
// own image goes through /api/profile/image instead.
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const choice = body?.choice;
  if (
    typeof choice !== "string" ||
    (choice !== NO_BACKGROUND && !BACKGROUND_PRESETS.some((p) => p.id === choice))
  ) {
    return NextResponse.json({ error: "Unknown background" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { backgroundImage: true },
  });

  // The default preset is stored as null so a future change of default
  // reaches everyone who never picked one explicitly.
  const value =
    choice === NO_BACKGROUND ? NO_BACKGROUND : choice === DEFAULT_BACKGROUND_ID ? null : presetValue(choice);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { backgroundImage: value },
  });

  // Switching away from an upload frees its blob, as the remove button does.
  const oldUrl = existing?.backgroundImage;
  if (isUploadedBackground(oldUrl)) await del(oldUrl).catch(() => null);

  return NextResponse.json({ ok: true });
}
