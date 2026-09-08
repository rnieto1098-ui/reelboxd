import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProfileStats } from "@/lib/stats";
import { formatDayKey, formatDuration, formatWatchTime } from "@/lib/statsCompute";
import { getTopPeopleStats } from "@/lib/peopleStats";
import { posterUrl } from "@/lib/tmdb";
import { formatRuntime } from "@/lib/format";
import { ReleaseYearChart } from "@/components/ReleaseYearChart";
import { PersonRankList } from "@/components/PersonRankList";
import { WatchHeatmap } from "@/components/stats/WatchHeatmap";
import { RatingColumns } from "@/components/stats/RatingColumns";
import { RhythmColumns } from "@/components/stats/RhythmColumns";
import { HotTakeList } from "@/components/stats/HotTakeList";
import { MovieRankList } from "@/components/stats/MovieRankList";
import {
  BarList,
  Card,
  CardLabel,
  StatSection,
  StatTile,
} from "@/components/stats/StatsPrimitives";

export default async function StatsPage({ params }: PageProps<"/profile/[username]/stats">) {
  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const [stats, topPeople] = await Promise.all([
    getProfileStats(user.id),
    getTopPeopleStats(user.id),
  ]);

  const { summary, ratings, crowd, streaks, genres, decades, runtimes, watchlist } = stats;

  // A profile with a rating or an undated watched mark and no diary still
  // has plenty to show, so the empty state keys off the watched union rather
  // than off diary rows alone.
  const hasAnything = summary.filmsWatched > 0 || summary.watchlistSize > 0;

  const bestGenre = genres
    .filter((g) => g.averageRating != null)
    .sort((a, b) => (b.averageRating as number) - (a.averageRating as number))[0];
  const longestPoster = posterUrl(runtimes.longest?.posterPath ?? null, "w200");
  const certifiedCount = stats.certifications.reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      <Link
        href={`/profile/${username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {username}
      </Link>
      <div className="mt-1 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold">{username}&apos;s Stats</h1>
        <Link
          href={`/profile/${username}/year`}
          className="text-sm text-muted hover:text-accent-green hover:underline"
        >
          Year in review →
        </Link>
      </div>

      {!hasAnything ? (
        <p className="text-muted">
          Nothing watched yet — rate or log a film and this page fills in.
        </p>
      ) : (
        <div className="space-y-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="Films watched"
              value={summary.filmsWatched}
              hint={`${summary.entriesLogged} logged · ${summary.rewatches} rewatches`}
            />
            <StatTile
              label="Time watched"
              value={formatWatchTime(summary.watchMinutes)}
              hint={
                summary.watchMinutes > 0
                  ? `${Math.round(summary.watchMinutes / 60).toLocaleString()} hours`
                  : undefined
              }
            />
            <StatTile
              label="Average rating"
              value={summary.averageRating != null ? summary.averageRating.toFixed(2) : "—"}
              hint={`${summary.ratedCount} rated`}
              tone="blue"
            />
            <StatTile label="This year" value={summary.filmsThisYear} tone="blue" />
            <StatTile label="Likes" value={summary.likeCount} tone="orange" />
            <StatTile label="On watchlist" value={summary.watchlistSize} tone="orange" />
          </div>

          <StatSection
            title="The past year"
            description="Every film you logged, one square per day."
          >
            <Card>
              <WatchHeatmap data={stats.heatmap} />
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
                <MiniStat
                  label="Current streak"
                  value={`${streaks.currentStreak} day${streaks.currentStreak === 1 ? "" : "s"}`}
                />
                <MiniStat
                  label="Longest streak"
                  value={`${streaks.longestStreak} day${streaks.longestStreak === 1 ? "" : "s"}`}
                  hint={streaks.longestStreakEnd ? `ended ${formatDayKey(streaks.longestStreakEnd)}` : undefined}
                />
                <MiniStat
                  label="Days with a film"
                  value={`${stats.heatmap.activeDays}`}
                  hint={`${stats.heatmap.totalInWindow} logged this year`}
                />
                <MiniStat
                  label="Biggest day"
                  value={streaks.busiestDay ? `${streaks.busiestDay.count} films` : "—"}
                  hint={streaks.busiestDay ? formatDayKey(streaks.busiestDay.day) : undefined}
                />
              </div>
            </Card>
          </StatSection>

          {summary.ratedCount > 0 && (
            <StatSection
              title="How you rate"
              description="The shape of your scale, and where it sits next to everyone else's."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardLabel>Rating distribution</CardLabel>
                  <RatingColumns histogram={ratings} />
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                    {ratings.spreadLabel}
                    {ratings.mostUsedScore != null && (
                      <> — {ratings.mostUsedScore}★ is your most-used score</>
                    )}
                    {ratings.median != null && <>, and your median is {ratings.median.toFixed(1)}★</>}
                    .
                  </p>
                </Card>

                <Card>
                  <CardLabel>You vs. everyone else</CardLabel>
                  {crowd.comparedCount === 0 ? (
                    <p className="text-sm text-muted">
                      Not enough films with a community score to compare against yet.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-2xl font-bold tabular-nums text-accent-blue">
                            {formatSigned(crowd.averageDelta as number)}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                            Average gap
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold tabular-nums text-accent-orange">
                            {(crowd.contrarianIndex as number).toFixed(2)}
                          </p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                            Contrarian index
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                        {crowd.leanLabel}. Across {crowd.comparedCount} rated films your score sits
                        an average of {(crowd.contrarianIndex as number).toFixed(2)} points away from
                        TMDB&apos;s, on their 10-point scale.
                      </p>
                    </>
                  )}
                </Card>
              </div>
            </StatSection>
          )}

          {(crowd.championed.length > 0 || crowd.panned.length > 0) && (
            <StatSection
              title="Hot takes"
              description="The films where your rating and the crowd's disagree the most."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <HotTakeList
                  label="You championed"
                  description="Rated well above the community average."
                  takes={crowd.championed}
                  tone="up"
                  emptyMessage="No strong disagreements upward yet."
                />
                <HotTakeList
                  label="You weren't sold"
                  description="Rated well below the community average."
                  takes={crowd.panned}
                  tone="down"
                  emptyMessage="No strong disagreements downward yet."
                />
                <HotTakeList
                  label="Dead on"
                  description="Where you and the crowd landed on the same number."
                  takes={crowd.agreedOn}
                  tone="flat"
                  emptyMessage="No exact matches yet."
                />
              </div>
            </StatSection>
          )}

          <StatSection
            title="What you watch"
            description="Counted once per film — rewatches don't stack the deck."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardLabel>Genres</CardLabel>
                <BarList
                  rows={genres.map((g) => ({
                    key: g.name,
                    label: g.name,
                    count: g.count,
                    badge:
                      g.averageRating != null
                        ? `${g.count} · ${g.averageRating.toFixed(1)}★`
                        : `${g.count}`,
                  }))}
                  labelWidth="w-24"
                />
                {bestGenre && (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                    You rate <span className="text-foreground">{bestGenre.name}</span> highest, at{" "}
                    {(bestGenre.averageRating as number).toFixed(2)}★ across {bestGenre.ratedCount}{" "}
                    rated films.
                  </p>
                )}
              </Card>

              <Card>
                <CardLabel>Decades</CardLabel>
                <BarList
                  rows={decades.map((d) => ({
                    key: `${d.decade}`,
                    label: `${d.decade}s`,
                    count: d.count,
                    badge:
                      d.averageRating != null
                        ? `${d.count} · ${d.averageRating.toFixed(1)}★`
                        : `${d.count}`,
                  }))}
                  accent="blue"
                  labelWidth="w-14"
                />
                {stats.favoriteDecade && (
                  <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                    The <span className="text-foreground">{stats.favoriteDecade.decade}s</span> are
                    your best-rated decade, at{" "}
                    {(stats.favoriteDecade.averageRating as number).toFixed(2)}★ across{" "}
                    {stats.favoriteDecade.count} films.
                  </p>
                )}
              </Card>
            </div>
          </StatSection>

          {stats.releaseYears.length > 0 && (
            <StatSection
              title="Across the timeline"
              description="Distinct films you've watched, by the year they came out."
            >
              <Card>
                <ReleaseYearChart buckets={stats.releaseYears} />
              </Card>
            </StatSection>
          )}

          <StatSection title="Length and rating boards">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardLabel>Runtime</CardLabel>
                <BarList rows={runtimes.buckets.map((b) => ({ key: b.label, label: b.label, count: b.count }))} labelWidth="w-24" />
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                  {runtimes.longest && (
                    <>
                      <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-background">
                        {longestPoster && (
                          <Image
                            src={longestPoster}
                            alt={runtimes.longest.title}
                            width={40}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 text-xs text-muted">
                        <p>
                          Your longest sit was{" "}
                          <Link
                            href={`/movie/${runtimes.longest.tmdbId}`}
                            className="text-foreground hover:text-accent-green hover:underline"
                          >
                            {runtimes.longest.title}
                          </Link>{" "}
                          at {formatRuntime(runtimes.longest.runtime)}.
                        </p>
                        {runtimes.averageMinutes != null && (
                          <p className="mt-1">
                            You average {Math.round(runtimes.averageMinutes)} minutes a film.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Card>
                <CardLabel>Certification</CardLabel>
                {stats.certifications.length === 0 ? (
                  <p className="text-sm text-muted">No certifications recorded yet.</p>
                ) : (
                  <>
                    <BarList
                      rows={stats.certifications.map((c) => ({
                        key: c.label,
                        label: c.label,
                        count: c.count,
                      }))}
                      accent="orange"
                      labelWidth="w-14"
                    />
                    {/* TMDB has no US certification for plenty of films, so
                        these bars cover a subset — saying which one keeps the
                        numbers from looking like they've lost films. */}
                    <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                      On file for {certifiedCount} of your {summary.filmsWatched} films.
                    </p>
                  </>
                )}
              </Card>
            </div>
          </StatSection>

          {summary.entriesLogged > 0 && (
            <StatSection
              title="When you watch"
              description="Every log you've ever made, folded onto a single week and a single year."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardLabel>By day of week</CardLabel>
                  <RhythmColumns buckets={stats.weekdays} />
                </Card>
                <Card>
                  <CardLabel>By month</CardLabel>
                  <RhythmColumns buckets={stats.months} accent="blue" />
                </Card>
              </div>
            </StatSection>
          )}

          <StatSection title="Your top films">
            <div className="grid gap-4 lg:grid-cols-2">
              <MovieRankList
                label="Most rewatched"
                entries={stats.leaderboards.mostRewatched}
                badgeFor={(e) => `${e.watchCount}×`}
                emptyMessage="Nothing logged more than once yet."
              />
              <MovieRankList
                label="Highest rated"
                entries={stats.leaderboards.highestRated}
                badgeFor={(e) => `${(e.rating as number).toFixed(1)}★`}
                emptyMessage="Nothing rated yet."
              />
            </div>
          </StatSection>

          {watchlist.size > 0 && (
            <StatSection
              title="The backlog"
              description="What's still waiting, and how long it's been waiting."
            >
              <Card>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MiniStat label="Films waiting" value={`${watchlist.size}`} />
                  <MiniStat
                    label="Longest wait"
                    value={
                      watchlist.oldestWaitDays != null
                        ? formatDuration(watchlist.oldestWaitDays)
                        : "—"
                    }
                  />
                  <MiniStat
                    label="Average wait"
                    value={
                      watchlist.averageWaitDays != null
                        ? formatDuration(watchlist.averageWaitDays)
                        : "—"
                    }
                  />
                  <MiniStat label="Added in 30 days" value={`${watchlist.addedLast30Days}`} />
                </div>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                  {watchlist.daysToClear != null ? (
                    <>
                      At the pace you&apos;ve kept over the past year, clearing it would take about{" "}
                      <span className="text-foreground">
                        {formatDuration(watchlist.daysToClear)}
                      </span>
                      .
                    </>
                  ) : (
                    <>Log a few watches and this will estimate how long clearing it would take.</>
                  )}
                </p>
              </Card>
            </StatSection>
          )}

          <PersonRankList
            title="Directors"
            mostWatched={topPeople.directors.mostWatched}
            highestRated={topPeople.directors.highestRated}
          />
          <PersonRankList
            title="Actors"
            mostWatched={topPeople.actors.mostWatched}
            highestRated={topPeople.actors.highestRated}
          />
          <PersonRankList
            title="Cinematographers"
            mostWatched={topPeople.cinematographers.mostWatched}
            highestRated={topPeople.cinematographers.highestRated}
          />
        </div>
      )}
    </div>
  );
}

// Signed off the rounded value, so a gap of +0.001 doesn't render as "+0.00".
function formatSigned(value: number): string {
  const rounded = Number(value.toFixed(2));
  return rounded > 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2);
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{label}</p>
      {hint && <p className="text-[11px] text-muted/70">{hint}</p>}
    </div>
  );
}
