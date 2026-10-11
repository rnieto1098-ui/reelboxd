import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getChallengeWatchlistCandidates } from "@/lib/challenges";
import {
  filterMoviesByStreaming,
  getUserOwnedTmdbIds,
  getUserProviderIds,
} from "@/lib/streaming";
import { addTmdbIdsToWatchlist } from "@/lib/watchlist";

// Challenges are public, so any signed-in viewer can add a challenge's films
// to *their own* watchlist, not only its owner.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { id } = await context.params;
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    select: { type: true, personId: true, department: true, listId: true, genreName: true },
  });
  if (!challenge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const streamingOnly = body?.streaming === true;

  let candidates = await getChallengeWatchlistCandidates(userId, challenge);

  // Mirrors the challenge page: the streaming filter only narrows CREW and
  // LIST grids, so "add all" adds exactly what the viewer is looking at.
  if (streamingOnly && (challenge.type === "CREW" || challenge.type === "LIST")) {
    const [providerIds, ownedIds] = await Promise.all([
      getUserProviderIds(userId),
      getUserOwnedTmdbIds(userId),
    ]);
    candidates = await filterMoviesByStreaming(candidates, providerIds, ownedIds);
  }

  const result = await addTmdbIdsToWatchlist(
    userId,
    candidates.map((c) => c.id)
  );
  return NextResponse.json(result);
}
