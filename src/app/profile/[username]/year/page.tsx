import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { posterUrl } from "@/lib/tmdb";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getYearInReview } from "@/lib/yearInReview";
import { getGoalProgress } from "@/lib/goals";
import { formatWatchTime } from "@/lib/stats";
import { currentYearUTC, parseYearParam } from "@/lib/dates";

function HighlightTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 text-center">
      <p className="text-3xl font-bold text-accent-green">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function MovieMomentCard({
  label,
  tmdbId,
  title,
  posterPath,
  caption,
}: {
  label: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  caption: string;
}) {
  const poster = posterUrl(posterPath, "w200");
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <Link href={`/movie/${tmdbId}`} className="group flex items-center gap-3">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-background">
          {poster && (
            <Image
              src={poster}
              alt={title}
              width={64}
              height={96}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium group-hover:text-accent-green">{title}</p>
          <p className="text-xs text-muted">{caption}</p>
        </div>
      </Link>
    </div>
  );
}

export default async function YearInReviewPage({
  params,
  searchParams,
}: PageProps<"/profile/[username]/year">) {
  const { username } = await params;
  const { year: yearParam } = await searchParams;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const currentYear = currentYearUTC();
  const year = parseYearParam(yearParam) ?? currentYear;

  const [review, goal] = await Promise.all([
    getYearInReview(user.id, year),
    getGoalProgress(user.id, year),
  ]);

  const posterOverrides = await getCustomPosterMap(
    session?.user?.id,
    [review.firstWatch, review.mostRecentWatch, review.favoriteDiscovery]
      .filter((m): m is NonNullable<typeof m> => m != null)
      .map((m) => m.tmdbId)
  );

  const maxGenreCount = Math.max(1, ...review.topGenres.map((g) => g.count));

  return (
    <div>
      <Link
        href={`/profile/${username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {username}
      </Link>

      <div className="relative isolate mt-1 mb-8 flex min-h-28 items-end gap-3 overflow-hidden rounded-2xl px-5 pb-5 pt-16 sm:min-h-40">
        {/* Celebration art (public/art/year-in-review.webp, Higgsfield); its
            bottom fades to the page colour so the title reads on top. */}
        <Image
          src="/art/year-in-review.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="-z-10 object-cover object-top"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/55 to-transparent"
        />
        <h1 className="page-title">
          {username}&apos;s {year} in Review
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/profile/${username}/year?year=${year - 1}`}
            className="text-muted hover:text-foreground"
          >
            ← {year - 1}
          </Link>
          {year < currentYear && (
            <Link
              href={`/profile/${username}/year?year=${year + 1}`}
              className="text-muted hover:text-foreground"
            >
              {year + 1} →
            </Link>
          )}
        </div>
      </div>

      {review.totalLogged === 0 ? (
        <p className="text-muted">Nothing logged in {year} yet.</p>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            <HighlightTile label="Films watched" value={review.totalLogged} />
            <HighlightTile label="Unique films" value={review.uniqueFilms} />
            <HighlightTile label="Rewatches" value={review.rewatches} />
            <HighlightTile label="Watch time" value={formatWatchTime(review.totalWatchMinutes)} />
            <HighlightTile
              label="Average rating"
              value={review.averageRating != null ? review.averageRating.toFixed(2) : "—"}
            />
          </div>

          {goal.target != null && (
            <p className="text-sm text-muted">
              {goal.percent != null && goal.percent >= 100
                ? `Goal reached — ${goal.count}/${goal.target} films! 🎉`
                : `${goal.count} of ${goal.target} films toward the ${year} goal (${goal.percent}%).`}
            </p>
          )}

          {review.busiestMonth && (
            <p className="text-sm text-muted">
              Busiest month: <span className="text-foreground">{review.busiestMonth}</span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {review.firstWatch && (
              <MovieMomentCard
                label="First watch of the year"
                tmdbId={review.firstWatch.tmdbId}
                title={review.firstWatch.title}
                posterPath={
                  posterOverrides.get(review.firstWatch.tmdbId) ?? review.firstWatch.posterPath
                }
                caption={review.firstWatch.watchedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              />
            )}
            {review.mostRecentWatch && (
              <MovieMomentCard
                label="Most recent watch"
                tmdbId={review.mostRecentWatch.tmdbId}
                title={review.mostRecentWatch.title}
                posterPath={
                  posterOverrides.get(review.mostRecentWatch.tmdbId) ??
                  review.mostRecentWatch.posterPath
                }
                caption={review.mostRecentWatch.watchedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              />
            )}
            {review.favoriteDiscovery && (
              <MovieMomentCard
                label="Favorite discovery"
                tmdbId={review.favoriteDiscovery.tmdbId}
                title={review.favoriteDiscovery.title}
                posterPath={
                  posterOverrides.get(review.favoriteDiscovery.tmdbId) ??
                  review.favoriteDiscovery.posterPath
                }
                caption={`${review.favoriteDiscovery.score.toFixed(1)} ★`}
              />
            )}
          </div>

          {review.topGenres.length > 0 && (
            <section>
              <h2 className="section-title mb-3">Top genres</h2>
              <div className="space-y-1.5">
                {review.topGenres.map((genre) => (
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
