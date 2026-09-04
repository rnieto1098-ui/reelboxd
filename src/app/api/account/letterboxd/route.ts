import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncLetterboxdDiary } from "@/lib/letterboxdSync";
import { syncLetterboxdWatchlist } from "@/lib/letterboxdWatchlistSync";

const connectSchema = z.object({
  username: z.string().trim().min(1).max(50),
});

// Connects (or re-points) the signed-in user's Letterboxd sync, then runs
// an immediate first sync so connecting isn't a dead end until the next
// scheduled run.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid username" },
      { status: 400 }
    );
  }

  const username = parsed.data.username.replace(/^@/, "");

  let summary;
  try {
    summary = await syncLetterboxdDiary(session.user.id, username);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't connect that account" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { letterboxdUsername: username },
  });

  // Best-effort — a broken/failed watchlist scrape shouldn't fail the
  // whole connect flow, since the diary sync above already succeeded.
  const watchlist = await syncLetterboxdWatchlist(session.user.id, username).catch((error) => ({
    added: 0,
    unmatched: [] as string[],
    remaining: 0,
    error: error instanceof Error ? error.message : "Watchlist sync failed",
  }));

  return NextResponse.json({
    username,
    ...summary,
    watchlistAdded: watchlist.added,
    watchlistError: "error" in watchlist ? watchlist.error : null,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      letterboxdUsername: null,
      letterboxdSyncedAt: null,
      letterboxdWatchlistSyncedAt: null,
      letterboxdWatchlistSyncBroken: false,
    },
  });

  return NextResponse.json({ ok: true });
}
