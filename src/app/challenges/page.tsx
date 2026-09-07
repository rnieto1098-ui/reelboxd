import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getGoalProgress } from "@/lib/goals";
import { getChallengesWithProgress, type ChallengeSummary } from "@/lib/challenges";
import { getGenres } from "@/lib/tmdb";
import { formatTimeLeft, currentYearUTC } from "@/lib/dates";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";
import { NewChallengeForm } from "@/components/NewChallengeForm";
import { RandomChallengeButton } from "@/components/RandomChallengeButton";
import { DeleteChallengeButton } from "@/components/DeleteChallengeButton";
import { EditableTitle } from "@/components/EditableTitle";

const TYPE_LABEL: Record<ChallengeSummary["type"], string> = {
  GENRE: "Genre",
  TIMEFRAME: "Time frame",
  CREW: "Crew",
  LIST: "List",
};

function ChallengeCard({ challenge }: { challenge: ChallengeSummary }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent-green">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="mb-1 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
            {TYPE_LABEL[challenge.type]}
          </span>
          <EditableTitle
            endpoint={`/api/challenges/${challenge.id}`}
            title={challenge.title}
            href={`/challenges/${challenge.id}`}
            canEdit
          />
        </div>
        <DeleteChallengeButton challengeId={challenge.id} />
      </div>
      <Link href={`/challenges/${challenge.id}`} className="block">
        <div className="h-3 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full bg-accent-green transition-all"
            style={{ width: `${challenge.percent ?? 0}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted hover:text-foreground">
          {challenge.target != null
            ? challenge.percent != null && challenge.percent >= 100
              ? `Complete — ${challenge.count}/${challenge.target} films! 🎉`
              : `${challenge.count} / ${challenge.target} films`
            : `${challenge.count} films logged`}
        </p>
        {challenge.type === "TIMEFRAME" && challenge.endDate && (
          <p className="mt-0.5 text-xs text-muted">{formatTimeLeft(challenge.endDate)}</p>
        )}
      </Link>
    </div>
  );
}

export default async function ChallengesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentYear = currentYearUTC();
  const [goal, challenges, genresData] = await Promise.all([
    getGoalProgress(session.user.id, currentYear),
    getChallengesWithProgress(session.user.id),
    getGenres().catch(() => ({ genres: [] })),
  ]);
  const genreNames = genresData.genres.map((g) => g.name).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Challenges</h1>
      <p className="mb-8 text-sm text-muted">
        Your yearly watch goal, plus any custom challenges you&apos;ve set for yourself.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{currentYear} Challenge</h2>
        <WatchGoalWidget
          year={goal.year}
          target={goal.target}
          count={goal.count}
          percent={goal.percent}
          isOwner
          username={session.user.name ?? ""}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Custom challenges</h2>
        <div className="mb-4 flex flex-wrap items-start gap-2">
          <NewChallengeForm genres={genreNames} />
          <RandomChallengeButton />
        </div>

        {challenges.length === 0 ? (
          <p className="text-sm text-muted">
            No custom challenges yet — try a genre quota, a date-range quota, watching a
            director&apos;s whole filmography, or working through one of your lists.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {challenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
