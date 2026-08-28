import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureMovieCached } from "@/lib/movies";
import { createDiaryEntry } from "@/lib/diary";

const diarySchema = z.object({
  tmdbId: z.number().int().positive(),
  watchedDate: z.string().optional(),
  rewatch: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = diarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid entry" },
      { status: 400 }
    );
  }

  const movie = await ensureMovieCached(parsed.data.tmdbId);

  const entry = await createDiaryEntry({
    userId: session.user.id,
    movieId: movie.id,
    watchedDate: parsed.data.watchedDate ? new Date(parsed.data.watchedDate) : undefined,
    rewatch: parsed.data.rewatch,
  });

  return NextResponse.json(entry, { status: 201 });
}
