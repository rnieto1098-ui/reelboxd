import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserStats, formatWatchTime } from "@/lib/stats";
import { getGoalProgress } from "@/lib/goals";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-2xl font-bold text-accent-green">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function StatsPage({ params }: PageProps<"/profile/[username]/stats">) {
  const { username } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const isOwnProfile = session?.user?.id === user.id;
  const currentYear = new Date().getFullYear();

  const [stats, goal] = await Promise.all([
    getUserStats(user.id),
    getGoalProgress(user.id, currentYear),
  ]);
  const maxBucketCount = Math.max(1, ...stats.ratingDistribution.map((b) => b.count));
  const maxGenreCount = Math.max(1, ...stats.topGenres.map((g) => g.count));

  return (
    <div>
      <Link
        href={`/profile/${username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {username}
      </Link>
      <h1 className="mt-1 mb-8 text-2xl font-bold">{username}&apos;s Stats</h1>

      <div className="mb-8">
        <WatchGoalWidget
          year={goal.year}
          target={goal.target}
          count={goal.count}
          percent={goal.percent}
          isOwner={isOwnProfile}
        />
      </div>

      {stats.totalLogged === 0 ? (
        <p className="text-muted">Nothing logged yet — stats will show up here once you do.</p>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            <StatTile label="Films logged" value={stats.totalLogged} />
            <StatTile label="Unique films" value={stats.uniqueFilms} />
            <StatTile label="Rewatches" value={stats.rewatches} />
            <StatTile label="Watch time" value={formatWatchTime(stats.totalWatchMinutes)} />
            <StatTile
              label="Average rating"
              value={stats.averageRating != null ? stats.averageRating.toFixed(2) : "—"}
            />
          </div>

          {stats.busiestMonth && (
            <p className="text-sm text-muted">
              You log the most in <span className="text-foreground">{stats.busiestMonth}</span>.
            </p>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Rating distribution</h2>
            <div className="space-y-1.5">
              {stats.ratingDistribution.map((bucket) => (
                <div key={bucket.score} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-muted">{bucket.score}★</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-background">
                    <div
                      className="h-full rounded bg-accent-green"
                      style={{ width: `${(bucket.count / maxBucketCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-muted">{bucket.count}</span>
                </div>
              ))}
            </div>
          </section>

          {stats.topGenres.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Top genres</h2>
              <div className="space-y-1.5">
                {stats.topGenres.map((genre) => (
                  <div key={genre.name} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate text-muted">{genre.name}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-background">
                      <div
                        className="h-full rounded bg-accent-blue"
                        style={{ width: `${(genre.count / maxGenreCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-muted">{genre.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
