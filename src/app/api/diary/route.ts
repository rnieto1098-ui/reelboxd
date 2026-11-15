import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { movieForRoute } from "@/lib/movieRoute";
import { createDiaryEntry } from "@/lib/diary";
import { checkNewlyCompletedChallenges } from "@/lib/challenges";
import { checkGoalJustCompleted } from "@/lib/goals";
import { parseCalendarDate } from "@/lib/dates";

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

  const body = await request.json().catch(() => null);
  const parsed = diarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid entry" },
      { status: 400 }
    );
  }

  const cached = await movieForRoute(parsed.data.tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;
  // A date, when given, must be a real "YYYY-MM-DD" calendar date. It used to
  // go straight into `new Date()`, so a malformed value became an Invalid
  // Date and a 500, and "2999-01-01" was happily stored.
  let watchedDate = new Date();
  if (parsed.data.watchedDate != null) {
    const parsedDate = parseCalendarDate(parsed.data.watchedDate);
    if (!parsedDate) {
      return NextResponse.json({ error: "That isn't a valid watch date." }, { status: 400 });
    }
    watchedDate = parsedDate;
  }

  const { entry, created } = await createDiaryEntry({
    userId: session.user.id,
    movieId: movie.id,
    watchedDate,
    rewatch: parsed.data.rewatch,
  });

  // Already logged today — nothing new happened, so no watchlist/challenge/
  // goal side effects and no second "logged!" toast.
  if (!created) {
    return NextResponse.json(
      { ...entry, alreadyLogged: true, completedChallenges: [], completedGoal: null },
      { status: 200 }
    );
  }

  // A rewatch can't newly satisfy a challenge (those count distinct movies,
  // already counted on the first watch) but can still push the yearly goal
  // over (that counts every log, rewatches included).
  const [completedChallenges, completedGoal] = await Promise.all([
    entry.rewatch ? Promise.resolve([]) : checkNewlyCompletedChallenges(session.user.id, movie, watchedDate),
    checkGoalJustCompleted(session.user.id, watchedDate),
  ]);

  return NextResponse.json({ ...entry, completedChallenges, completedGoal }, { status: 201 });
}
