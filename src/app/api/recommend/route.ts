import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPromptRecommendations } from "@/lib/promptRecommender";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";

const promptSchema = z
  .object({
    prompt: z.string().max(500).default(""),
    genres: z.array(z.string()).max(12).default([]),
    maxRuntimeMinutes: z.number().int().positive().max(600).nullable().optional(),
  })
  .refine(
    (data) => data.prompt.trim().length >= 3 || data.genres.length > 0 || data.maxRuntimeMinutes != null,
    { message: "Tell us a bit more about what you're in the mood for, or pick a genre/runtime." }
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
  });

  const posterOverrides = await getCustomPosterMap(
    session.user.id,
    recommendation.results.map((m) => m.id)
  );

  return NextResponse.json({
    ...recommendation,
    results: applyPosterOverrides(recommendation.results, posterOverrides),
  });
}
