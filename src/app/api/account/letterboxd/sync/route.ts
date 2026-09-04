import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncLetterboxdDiary } from "@/lib/letterboxdSync";
import { syncLetterboxdWatchlist } from "@/lib/letterboxdWatchlistSync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { letterboxdUsername: true },
  });
  if (!user?.letterboxdUsername) {
    return NextResponse.json({ error: "No Letterboxd account connected" }, { status: 400 });
  }

  let summary;
  try {
    summary = await syncLetterboxdDiary(session.user.id, user.letterboxdUsername);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 502 }
    );
  }

  // Best-effort — a broken/failed watchlist scrape shouldn't fail the whole
  // "sync now" click, since the diary sync above already succeeded.
  const watchlist = await syncLetterboxdWatchlist(session.user.id, user.letterboxdUsername).catch(
    (error) => ({
      added: 0,
      unmatched: [] as string[],
      remaining: 0,
      error: error instanceof Error ? error.message : "Watchlist sync failed",
    })
  );

  return NextResponse.json({
    ...summary,
    watchlistAdded: watchlist.added,
    watchlistError: "error" in watchlist ? watchlist.error : null,
  });
}
