import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPromptRecommendations } from "@/lib/promptRecommender";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";

const promptSchema = z
  .object({
    prompt: z.string().max(500).default(""),
    genres: z.array(z.string()).max(12).default([]),
    maxRuntimeMinutes: z.number().int().positive().max(600).nullable().optional(),
    onlyWatchlist: z.boolean().default(false),
    onlyStreaming: z.boolean().default(false),
    // R is allowed by default — the UI's "PG-13 and below" toggle sends
    // allowR: false to opt INTO the stricter cap.
    allowR: z.boolean().default(true),
    excludeIds: z.array(z.number().int().positive()).max(100).default([]),
  })
  .refine(
    (data) =>
      data.prompt.trim().length >= 3 ||
      data.genres.length > 0 ||
      data.maxRuntimeMinutes != null ||
      data.onlyWatchlist ||
      data.onlyStreaming ||
      // allowR === true is the default (no filter picked) — only an
      // active restriction to PG-13 counts as a selection.
      !data.allowR,
    { message: "Tell us a bit more about what you're in the mood for, or pick a filter." }
  );

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = promptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Tell us a bit more about what you're in the mood for." },
      { status: 400 }
    );
  }

  const recommendation = await getPromptRecommendations(session.user.id, parsed.data.prompt, {
    genreNames: parsed.data.genres,
    maxRuntimeMinutes: parsed.data.maxRuntimeMinutes ?? null,
    onlyWatchlist: parsed.data.onlyWatchlist,
    onlyStreaming: parsed.data.onlyStreaming,
    allowR: parsed.data.allowR,
    excludeIds: parsed.data.excludeIds,
  });

  const [posterOverrides, ownedIds, watchlistIds] = await Promise.all([
    getCustomPosterMap(session.user.id, recommendation.results.map((m) => m.id)),
    getUserOwnedTmdbIds(session.user.id),
    getUserWatchlistedTmdbIds(session.user.id),
  ]);

  return NextResponse.json({
    ...recommendation,
    results: applyPosterOverrides(recommendation.results, posterOverrides),
    ownedIds: [...ownedIds],
    watchlistIds: [...watchlistIds],
  });
}
