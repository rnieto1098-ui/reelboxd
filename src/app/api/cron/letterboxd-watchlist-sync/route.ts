import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncLetterboxdWatchlist, LetterboxdWatchlistBrokenError } from "@/lib/letterboxdWatchlistSync";
import { sendLetterboxdWatchlistBrokenEmail } from "@/lib/email";

// Runs daily (see vercel.json) for every connected Letterboxd account —
// reuses the same letterboxdUsername the diary sync already has, so
// connecting once covers both. See letterboxdWatchlistSync.ts for why this
// is meaningfully more fragile than the diary sync and add-only by design.
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
    select: { id: true, email: true, letterboxdUsername: true, letterboxdWatchlistSyncBroken: true },
  });

  const results: {
    userId: string;
    ok: boolean;
    added?: number;
    unmatched?: number;
    broken?: boolean;
    error?: string;
  }[] = [];

  for (let i = 0; i < users.length; i += SYNC_CONCURRENCY) {
    const batch = users.slice(i, i + SYNC_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (user) => {
        try {
          const summary = await syncLetterboxdWatchlist(user.id, user.letterboxdUsername!);
          return { userId: user.id, ok: true, added: summary.added, unmatched: summary.unmatched.length };
        } catch (error) {
          const broken = error instanceof LetterboxdWatchlistBrokenError;
          if (broken && !user.letterboxdWatchlistSyncBroken) {
            // Transition into broken — flag it and notify once, without
            // letting a failed email send block the flag from being set.
            await prisma.user
              .update({ where: { id: user.id }, data: { letterboxdWatchlistSyncBroken: true } })
              .catch(() => null);
            await sendLetterboxdWatchlistBrokenEmail(user.email, user.letterboxdUsername!).catch(() => null);
          }
          return {
            userId: user.id,
            ok: false,
            broken,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );
    results.push(...batchResults);
  }

  return NextResponse.json({ synced: results.length, results });
}
