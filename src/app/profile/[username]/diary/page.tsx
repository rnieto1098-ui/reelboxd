import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { posterUrl } from "@/lib/tmdb";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getGoalProgress } from "@/lib/goals";
import { yearBounds } from "@/lib/dates";
import { DeleteDiaryEntryButton } from "@/components/DeleteDiaryEntryButton";

export default async function DiaryPage({
  params,
  searchParams,
}: PageProps<"/profile/[username]/diary">) {
  const { username } = await params;
  const { year: yearParam } = await searchParams;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const isOwnProfile = session?.user?.id === user.id;

  const year =
    typeof yearParam === "string" && Number.isFinite(Number(yearParam))
      ? Number(yearParam)
      : null;
  const goal = year != null ? await getGoalProgress(user.id, year) : null;
  const bounds = year != null ? yearBounds(year) : null;

  const [entries, ratings] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: bounds
        ? { userId: user.id, watchedDate: { gte: bounds.start, lt: bounds.end } }
        : { userId: user.id },
      include: { movie: true },
      orderBy: { watchedDate: "desc" },
    }),
    prisma.rating.findMany({
      where: { userId: user.id },
      select: { score: true, movieId: true },
    }),
  ]);

  const ratingByMovieId = new Map(ratings.map((r) => [r.movieId, r.score]));
  const posterOverrides = await getCustomPosterMap(
    session?.user?.id,
    entries.map((e) => e.movie.tmdbId)
  );

  // Group consecutive entries by "Month Year" — the list is already sorted
  // newest-first, so this is a single pass, not a sort-by-key.
  const groups: { label: string; entries: typeof entries }[] = [];
  for (const entry of entries) {
    const label = entry.watchedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <div>
      <Link
        href={`/profile/${username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {username}
      </Link>
      <h1 className="mt-1 text-2xl font-bold">
        {username}&apos;s Diary{year != null && ` — ${year} Challenge`}
      </h1>
      <div className="mb-8">
        <p className="text-sm text-muted">
          {entries.length} logged watch{entries.length === 1 ? "" : "es"}
          {goal?.target != null && ` toward the ${year} goal of ${goal.target}`}
        </p>
        {year != null && (
          <Link
            href={`/profile/${username}/diary`}
            className="text-xs text-muted hover:text-foreground hover:underline"
          >
            Show entire diary
          </Link>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-muted">
          {year != null ? `No entries logged in ${year} yet.` : "No diary entries yet."}
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 text-sm font-semibold text-muted">{group.label}</h2>
              <div className="space-y-2">
                {group.entries.map((entry) => {
                  const poster = posterUrl(
                    posterOverrides.get(entry.movie.tmdbId) ?? entry.movie.posterPath,
                    "w200"
                  );
                  const rating = ratingByMovieId.get(entry.movieId);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2"
                    >
                      <div className="w-8 shrink-0 text-center text-xs text-muted">
                        {entry.watchedDate.toLocaleDateString("en-US", { day: "numeric" })}
                      </div>
                      <Link
                        href={`/movie/${entry.movie.tmdbId}`}
                        className="h-16 w-11 shrink-0 overflow-hidden rounded border border-border bg-background"
                      >
                        {poster && (
                          <Image
                            src={poster}
                            alt={entry.movie.title}
                            width={44}
                            height={66}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/movie/${entry.movie.tmdbId}`}
                          className="block truncate text-sm font-medium hover:text-accent-green"
                        >
                          {entry.movie.title}
                        </Link>
                        <p className="text-xs text-muted">
                          {entry.movie.releaseDate?.slice(0, 4)}
                          {entry.rewatch && " · Rewatch"}
                          {rating != null && ` · ${rating.toFixed(1)} ★`}
                        </p>
                      </div>
                      {isOwnProfile && <DeleteDiaryEntryButton entryId={entry.id} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
