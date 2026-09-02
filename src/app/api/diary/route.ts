import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { ensureMovieCached } from "@/lib/movies";
import { createDiaryEntry } from "@/lib/diary";
import { checkNewlyCompletedChallenges } from "@/lib/challenges";
import { checkGoalJustCompleted } from "@/lib/goals";

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
  const watchedDate = parsed.data.watchedDate ? new Date(parsed.data.watchedDate) : new Date();

  const entry = await createDiaryEntry({
    userId: session.user.id,
    movieId: movie.id,
    watchedDate,
    rewatch: parsed.data.rewatch,
  });

  // A rewatch can't newly satisfy a challenge (those count distinct movies,
  // already counted on the first watch) but can still push the yearly goal
  // over (that counts every log, rewatches included).
  const [completedChallenges, completedGoal] = await Promise.all([
    entry.rewatch ? Promise.resolve([]) : checkNewlyCompletedChallenges(session.user.id, movie, watchedDate),
    checkGoalJustCompleted(session.user.id, watchedDate),
  ]);

  return NextResponse.json({ ...entry, completedChallenges, completedGoal }, { status: 201 });
}
