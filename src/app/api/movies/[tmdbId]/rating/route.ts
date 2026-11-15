import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { movieForRoute, parseTmdbId } from "@/lib/movieRoute";
import { createDiaryEntry } from "@/lib/diary";
import { checkNewlyCompletedChallenges } from "@/lib/challenges";
import { checkGoalJustCompleted } from "@/lib/goals";
import { parseCalendarDate } from "@/lib/dates";

const ratingSchema = z.object({
  score: z.number().min(0.5).max(5).multipleOf(0.5),
  // The viewer's own calendar date ("YYYY-MM-DD"), used for the diary entry
  // a first rating creates. Optional so older clients keep working.
  date: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  const { tmdbId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rating" },
      { status: 400 }
    );
  }

  const cached = await movieForRoute(tmdbId);
  if (cached.response) return cached.response;
  const movie = cached.movie;

  // Rating a film for the first time is also taken as "I just watched this"
  // and logs it in the diary. That is only true if the film wasn't already
  // recorded as seen some other way: this used to check for a previous
  // rating alone, so rating a film that was already in the diary (from a
  // Letterboxd import, say) or marked watched added a second, phantom
  // entry dated today, flagged as a rewatch.
  const [existingRating, existingDiary, existingMark] = await Promise.all([
    prisma.rating.findUnique({
      where: { userId_movieId: { userId, movieId: movie.id } },
      select: { id: true },
    }),
    prisma.diaryEntry.findFirst({ where: { userId, movieId: movie.id }, select: { id: true } }),
    prisma.watchedItem.findUnique({
      where: { userId_movieId: { userId, movieId: movie.id } },
      select: { id: true },
    }),
  ]);
  const alreadyWatched = !!(existingRating || existingDiary || existingMark);
  // The viewer's date if they sent a valid one, otherwise the server's.
  const watchedDate = parseCalendarDate(parsed.data.date) ?? new Date();

  const [rating, , logged] = await Promise.all([
    prisma.rating.upsert({
      where: { userId_movieId: { userId, movieId: movie.id } },
      update: { score: parsed.data.score },
      create: { userId, movieId: movie.id, score: parsed.data.score },
    }),
    // Rating a movie means it's watched — it doesn't belong on the
    // watchlist anymore. A no-op if it was never there.
    prisma.watchlistItem.deleteMany({ where: { userId, movieId: movie.id } }),
    alreadyWatched
      ? Promise.resolve(null)
      : createDiaryEntry({ userId, movieId: movie.id, watchedDate }),
  ]);

  // Only a rating that newly marked the film as seen can finish a challenge
  // or the yearly goal, so only then is it worth the extra queries. Returned
  // so the stars can celebrate it the way the Log and Watched buttons do.
  const loggedToday = !!logged?.created;
  const [completedChallenges, completedGoal] = alreadyWatched
    ? [[], null]
    : await Promise.all([
        checkNewlyCompletedChallenges(userId, movie, loggedToday ? watchedDate : null),
        loggedToday ? checkGoalJustCompleted(userId, watchedDate) : Promise.resolve(null),
      ]);

  return NextResponse.json({ ...rating, loggedToday, completedChallenges, completedGoal });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tmdbId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tmdbId } = await context.params;
  const id = parseTmdbId(tmdbId);
  if (id == null) return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  const movie = await prisma.movie.findUnique({ where: { tmdbId: id } });
  if (!movie) return NextResponse.json({ ok: true });

  await prisma.rating
    .delete({
      where: { userId_movieId: { userId: session.user.id, movieId: movie.id } },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
