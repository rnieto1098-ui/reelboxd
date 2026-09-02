import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLetterboxdDiary } from "@/lib/letterboxdSync";

// Runs on Vercel's cron schedule (see vercel.json) to sync every connected
// account without anyone needing to visit the site and click "Sync now" —
// this is what makes a Letterboxd log "just show up" in Flixtally on its
// own. Vercel signs cron requests with `Authorization: Bearer $CRON_SECRET`;
// set CRON_SECRET in the project's environment variables so this can't be
// triggered by anyone who finds the URL.
const SYNC_CONCURRENCY = 3;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const users = await prisma.user.findMany({
    where: { letterboxdUsername: { not: null } },
    select: { id: true, letterboxdUsername: true },
  });

  const results: { userId: string; ok: boolean; imported?: number; error?: string }[] = [];

  for (let i = 0; i < users.length; i += SYNC_CONCURRENCY) {
    const batch = users.slice(i, i + SYNC_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (user) => {
        try {
          const summary = await syncLetterboxdDiary(user.id, user.letterboxdUsername!);
          return { userId: user.id, ok: true, imported: summary.imported };
        } catch (error) {
          return {
            userId: user.id,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return NextResponse.json({ synced: results.length, results });
}
