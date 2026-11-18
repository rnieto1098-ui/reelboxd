import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { getGoalProgress } from "@/lib/goals";
import { getChallengesWithProgress } from "@/lib/challenges";
import { challengeStatus } from "@/lib/challengeStatus";
import { getGenres } from "@/lib/tmdb";
import { currentYearUTC } from "@/lib/dates";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";
import { NewChallengeForm } from "@/components/NewChallengeForm";
import { RandomChallengeButton } from "@/components/RandomChallengeButton";
import { ChallengeCard } from "@/components/ChallengeCard";

export const metadata: Metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/challenges");

  const currentYear = currentYearUTC();
  const [goal, challenges, genresData] = await Promise.all([
    getGoalProgress(session.user.id, currentYear),
    getChallengesWithProgress(session.user.id),
    getGenres().catch(() => ({ genres: [] })),
  ]);
  const genreNames = genresData.genres.map((g) => g.name).sort((a, b) => a.localeCompare(b));

  // Active first and nearest to done at the top, so the next one to finish
  // is the first thing you see. Finished and expired ones each get their own
  // shelf below instead of being mixed in among them.
  const now = new Date();
  const withStatus = challenges.map((c) => ({ challenge: c, status: challengeStatus(c, now) }));
  const active = withStatus
    .filter((c) => c.status === "active")
    .sort((a, b) => (b.challenge.percent ?? 0) - (a.challenge.percent ?? 0));
  const complete = withStatus.filter((c) => c.status === "complete");
  const ended = withStatus.filter((c) => c.status === "ended");

  const stats = [
    { icon: Flame, label: "In progress", value: active.length },
    { icon: Trophy, label: "Completed", value: complete.length },
  ];

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2">Challenges</p>
          <h1 className="page-title">Give your watching a goal</h1>
          <p className="mt-2 max-w-xl text-muted">
            Set a number for the year, take on a genre or a director&apos;s whole filmography,
            and watch the rings fill in.
          </p>
        </div>
        <dl className="flex gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="card flex items-center gap-3 px-4 py-3">
              <Icon aria-hidden className="h-5 w-5 text-accent-green" />
              <div>
                <dd className="font-[family-name:var(--font-display)] text-xl font-bold leading-none tabular-nums">
                  {value}
                </dd>
                <dt className="mt-1 text-xs text-muted">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </header>

      <WatchGoalWidget
        year={goal.year}
        target={goal.target}
        count={goal.count}
        percent={goal.percent}
        pace={goal.pace}
        isOwner
        username={session.user.name ?? ""}
      />

      <section aria-labelledby="active-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="active-heading" className="section-title">
            In progress
          </h2>
          <div className="flex flex-wrap items-start gap-2">
            <RandomChallengeButton />
            <NewChallengeForm genres={genreNames} />
          </div>
        </div>

        {active.length === 0 ? (
          <div className="rounded-[0.875rem] border border-dashed border-border-strong px-6 py-10 text-center">
            <Trophy aria-hidden className="mx-auto mb-3 h-8 w-8 text-subtle" />
            <p className="font-semibold">
              {challenges.length === 0 ? "No challenges yet" : "Nothing in progress"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Try a genre quota, a number of films inside a date range, or every film by a
              director you like. To turn a list into a challenge, open the list and choose
              &ldquo;Make this a challenge&rdquo;.
            </p>
            <Link href="/lists" className="btn btn-outline btn-sm mt-4">
              Browse lists
            </Link>
          </div>
        ) : (
          <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map(({ challenge }, i) => (
              <div key={challenge.id} style={{ "--i": i } as React.CSSProperties}>
                <ChallengeCard challenge={challenge} canEdit />
              </div>
            ))}
          </div>
        )}
      </section>

      {complete.length > 0 && (
        <section aria-labelledby="complete-heading">
          <h2 id="complete-heading" className="section-title mb-4 flex items-center gap-2">
            <Trophy aria-hidden className="h-5 w-5 text-accent-gold" />
            Completed
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {complete.map(({ challenge }) => (
              <ChallengeCard key={challenge.id} challenge={challenge} canEdit />
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section aria-labelledby="ended-heading">
          <h2 id="ended-heading" className="section-title mb-1">
            Ended
          </h2>
          <p className="mb-4 text-sm text-muted">
            Date ranges that closed before the target was reached.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ended.map(({ challenge }) => (
              <ChallengeCard key={challenge.id} challenge={challenge} canEdit />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
