import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { posterUrl } from "@/lib/tmdb";
import { MAX_GUESSES, cluesFor, todayKey } from "@/lib/dailyGame";
import { getAnswer, getResult, getStats } from "@/lib/dailyGameData";
import { DailyGame } from "@/components/DailyGame";

export const metadata: Metadata = {
  title: "Daily Reel",
  description: "Guess today's mystery film from six clues. A new one every day.",
};

export default async function PlayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const day = todayKey();

  // The answer is looked up here, on the server, and only its poster and
  // first clue are handed to the page. The film itself stays behind until
  // the game is over (see /api/play/guess).
  const answer = await getAnswer(day).catch(() => null);

  const heading = (
    <header className="mb-8">
      <p className="eyebrow mb-2">
        Daily Reel{answer ? ` #${answer.number}` : ""}
      </p>
      <h1 className="page-title">Name today&apos;s mystery film</h1>
      <p className="mt-2 max-w-2xl text-muted">
        You have {MAX_GUESSES} guesses. Each wrong one sharpens the poster, unlocks another clue
        and tells you how your guess compares. Everyone gets the same film, and a new one
        arrives every day at midnight UTC.
      </p>
    </header>
  );

  if (!answer) {
    return (
      <div>
        {heading}
        <div className="rounded-[0.875rem] border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="font-semibold">No puzzle right now</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            The game draws its films from the curated lists, which haven&apos;t finished loading
            yet. Open the Lists page once, then come back.
          </p>
          <Link href="/lists" className="btn btn-outline btn-sm mt-4">
            Go to Lists
          </Link>
        </div>
      </div>
    );
  }

  const [stats, result] = userId
    ? await Promise.all([getStats(userId, day), getResult(userId, day)])
    : [null, null];

  return (
    <div>
      {heading}
      <DailyGame
        // A new day is a new game: remount rather than carry state across.
        key={day}
        day={day}
        number={answer.number}
        poster={posterUrl(answer.posterPath, "w500")}
        firstClue={cluesFor(answer.film)[0]}
        signedIn={!!userId}
        stats={stats}
        serverResult={
          result
            ? {
                solved: result.solved,
                attempts: result.attempts,
                answer: {
                  tmdbId: answer.film.tmdbId,
                  title: answer.film.title,
                  year: answer.film.year,
                },
              }
            : null
        }
      />
    </div>
  );
}
