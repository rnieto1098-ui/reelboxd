import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { ANNOUNCEMENT_MAX_LENGTH, saveSiteSettings } from "@/lib/siteSettings";

const settingsSchema = z.object({
  announcement: z.string().max(ANNOUNCEMENT_MAX_LENGTH),
  signupsOpen: z.boolean(),
});

/** Save the site-wide settings (announcement banner, sign-ups open). */
export async function PUT(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `The announcement can be at most ${ANNOUNCEMENT_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  await saveSiteSettings(parsed.data);
  return NextResponse.json({ ok: true });
}
