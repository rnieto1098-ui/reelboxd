import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { movieForRoute } from "@/lib/movieRoute";
import { MAX_GUESSES, cluesFor, compareGuess, isDayKey, todayKey } from "@/lib/dailyGame";
import { getAnswer, recordResult, toGameFilm } from "@/lib/dailyGameData";

const guessSchema = z.object({
  day: z.string(),
  tmdbId: z.number().int().positive(),
  // Which guess this is, 1 to 6. Tracked by the browser; see the note below.
  guessNumber: z.number().int().min(1).max(MAX_GUESSES),
});

/**
 * Checks one guess at today's mystery film.
 *
 * Open to signed-out visitors too: anyone can play, and only a signed-in
 * player's finished game is saved (for their streak).
 *
 * The answer never leaves the server until the game is over. The reply to a
 * wrong guess carries only how it compares and the next clue.
 *
 * The count of guesses used is kept by the browser rather than the server,
 * so someone determined could ask for clues out of turn. That spoils only
 * their own puzzle, and tracking every visitor's attempts server-side to
 * prevent it isn't worth the cost for a daily bit of fun.
 */
export async function POST(request: Request) {
  const parsed = guessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isDayKey(parsed.data.day)) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }
  const { day, tmdbId, guessNumber } = parsed.data;

  // Only today's puzzle can be played. A tab left open past midnight UTC is
  // told so, and the page loads the new one.
  if (day !== todayKey()) {
    return NextResponse.json(
      { error: "That puzzle has ended. Here's today's.", stale: true },
      { status: 409 }
    );
  }

  const answer = await getAnswer(day).catch(() => null);
  if (!answer) {
    return NextResponse.json({ error: "There's no puzzle today." }, { status: 503 });
  }

  const cached = await movieForRoute(tmdbId);
  if (cached.response) return cached.response;
  const guess = toGameFilm(cached.movie);

  const feedback = compareGuess(answer.film, guess);
  const finished = feedback.correct || guessNumber >= MAX_GUESSES;

  if (finished) {
    const session = await auth();
    if (session?.user?.id) {
      await recordResult(session.user.id, day, guessNumber, feedback.correct);
    }
  }

  return NextResponse.json({
    guess: { tmdbId: guess.tmdbId, title: guess.title, year: guess.year },
    feedback,
    // The clue unlocked by this wrong guess: clue 2 after guess 1, and so on.
    nextClue: finished ? null : cluesFor(answer.film)[guessNumber],
    answer: finished
      ? { tmdbId: answer.film.tmdbId, title: answer.film.title, year: answer.film.year }
      : null,
  });
}
