import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BACKGROUND_PRESETS,
  MATCH_TAB,
  NO_BACKGROUND,
  isUploadedBackground,
  presetValue,
} from "@/lib/backgrounds";

// Picks a preset site background, MATCH_TAB for a different preset on each
// tab, or "none" for a plain one. Uploading your
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
    (choice !== NO_BACKGROUND &&
      choice !== MATCH_TAB &&
      !BACKGROUND_PRESETS.some((p) => p.id === choice))
  ) {
    return NextResponse.json({ error: "Unknown background" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { backgroundImage: true },
  });

  // Match-each-tab is stored as null: it's the default, so a future change to
  // the tab backgrounds reaches everyone who never picked one explicitly.
  const value =
    choice === NO_BACKGROUND ? NO_BACKGROUND : choice === MATCH_TAB ? null : presetValue(choice);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { backgroundImage: value },
  });

  // Switching away from an upload frees its blob, as the remove button does.
  const oldUrl = existing?.backgroundImage;
  if (isUploadedBackground(oldUrl)) await del(oldUrl).catch(() => null);

  return NextResponse.json({ ok: true });
}
