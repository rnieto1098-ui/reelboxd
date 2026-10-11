import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addTmdbIdsToWatchlist } from "@/lib/watchlist";

export async function POST(
  _request: Request,
  context: { params: Promise<{ listId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { listId } = await context.params;
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { id: true, items: { select: { tmdbId: true } } },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Films from the list the user has already seen are left off — see
  // addToWatchlist. Reported back so the button can tell the user why a
  // 250-film list only added 180, rather than looking like it half-failed.
  const result = await addTmdbIdsToWatchlist(
    session.user.id,
    list.items.map((i) => i.tmdbId)
  );
  return NextResponse.json(result);
}
