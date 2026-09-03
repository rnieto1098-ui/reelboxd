import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getGoalProgress } from "@/lib/goals";
import { getChallengesWithProgress, type ChallengeSummary } from "@/lib/challenges";
import { MovieRow } from "@/components/MovieRow";
import { RecentlyLoggedRow } from "@/components/RecentlyLoggedRow";
import { SortChips } from "@/components/SortChips";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";
import { LetterboxdSyncCard } from "@/components/LetterboxdSyncCard";
import { OwnedImportForm } from "@/components/OwnedImportForm";
import { compareNullableNumbers, type SortDir } from "@/lib/sortComparator";
import type { TmdbMovieSummary } from "@/lib/tmdb";
import type { Movie } from "@prisma/client";

const SORT_OPTIONS = {
  recent: { label: "Recently Logged" },
  rating: { label: "Your Rating" },
  release: { label: "Release Date" },
  popularity: { label: "Popularity" },
} satisfies Record<string, { label: string }>;

type SortKey = keyof typeof SORT_OPTIONS;

// A movie can be rated, logged (diary), or both — this merges the two into
// one row per movie so "Recently Logged" reflects everything you've watched,
// not just what you got around to rating.
type RecentEntry = {
  movie: Movie;
  score: number | null;
  logCount: number;
  lastActivityAt: number;
};

function sortEntries(entries: RecentEntry[], sortKey: SortKey, dir: SortDir): RecentEntry[] {
  const valueOf = (e: RecentEntry): number | null => {
    if (sortKey === "recent") return e.lastActivityAt;
    if (sortKey === "rating") return e.score;
    if (sortKey === "release") return e.movie.releaseDate ? Date.parse(e.movie.releaseDate) : null;
    return e.movie.popularity;
  };
  return [...entries].sort((a, b) => compareNullableNumbers(valueOf(a), valueOf(b), dir));
}

const CHALLENGE_TYPE_LABEL: Record<ChallengeSummary["type"], string> = {
  GENRE: "Genre",
  TIMEFRAME: "Time frame",
  CREW: "Crew",
};

function ChallengeCard({ challenge }: { challenge: ChallengeSummary }) {
  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-accent-green"
    >
      <span className="mb-1 inline-block rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
        {CHALLENGE_TYPE_LABEL[challenge.type]}
      </span>
      <p className="text-sm font-semibold">{challenge.title}</p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-accent-green transition-all"
          style={{ width: `${challenge.percent ?? 0}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {challenge.target != null
          ? challenge.percent != null && challenge.percent >= 100
            ? `Complete — ${challenge.count}/${challenge.target} films! 🎉`
            : `${challenge.count} / ${challenge.target} films`
          : `${challenge.count} films logged`}
      </p>
    </Link>
  );
}

function buildHref(username: string, key: SortKey, dir: SortDir) {
  const params = new URLSearchParams();
  if (key !== "recent") params.set("sort", key);
  if (dir !== "desc") params.set("dir", dir);
  const qs = params.toString();
  return `/profile/${username}${qs ? `?${qs}` : ""}`;
}

export async function generateMetadata({
  params,
}: PageProps<"/profile/[username]">): Promise<Metadata> {
  const { username } = await params;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { image: true, _count: { select: { ratings: true } } },
  });
  if (!user) return {};

  const title = `${username} on Flixtally`;
  const description = `${user._count.ratings} film${user._count.ratings === 1 ? "" : "s"} rated on Flixtally.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: user.image ? [user.image] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: user.image ? [user.image] : undefined,
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/profile/[username]">) {
  const { username } = await params;
  const { sort, dir } = await searchParams;
  const sortKey: SortKey = typeof sort === "string" && sort in SORT_OPTIONS ? (sort as SortKey) : "recent";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";

  const session = await auth();
  const isOwnProfile = session?.user?.name === username;

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      ratings: { include: { movie: true } },
      diaryEntries: { include: { movie: true } },
      owned: {
        include: { movie: true },
        orderBy: { addedAt: "desc" },
        take: 24,
      },
      _count: {
        select: { ratings: true, watchlist: true, owned: true, diaryEntries: true },
      },
    },
  });

  if (!user) notFound();

  const byMovie = new Map<string, RecentEntry>();
  for (const r of user.ratings) {
    const activityAt = r.createdAt.getTime();
    const existing = byMovie.get(r.movieId);
    if (existing) {
      existing.score = r.score;
      existing.lastActivityAt = Math.max(existing.lastActivityAt, activityAt);
    } else {
      byMovie.set(r.movieId, { movie: r.movie, score: r.score, logCount: 0, lastActivityAt: activityAt });
    }
  }
  for (const d of user.diaryEntries) {
    const activityAt = d.watchedDate.getTime();
    const existing = byMovie.get(d.movieId);
    if (existing) {
      existing.logCount++;
      existing.lastActivityAt = Math.max(existing.lastActivityAt, activityAt);
    } else {
      byMovie.set(d.movieId, {
        movie: d.movie,
        score: null,
        logCount: 1,
        lastActivityAt: activityAt,
      });
    }
  }
  const recentEntries = sortEntries([...byMovie.values()], sortKey, sortDir).slice(0, 24);

  // Use the viewer's own poster choices, not the profile owner's — a custom
  // poster is a personal preference that follows you wherever a film shows up.
  // Same reasoning for owned/watchlist highlighting below: it reflects
  // whoever is looking, not necessarily this profile's owner.
  const [posterOverrides, viewerOwnedIds, viewerWatchlistIds, goal, challenges] = await Promise.all([
    getCustomPosterMap(session?.user?.id, [
      ...recentEntries.map((e) => e.movie.tmdbId),
      ...user.owned.map((o) => o.movie.tmdbId),
    ]),
    getUserOwnedTmdbIds(session?.user?.id),
    getUserWatchlistedTmdbIds(session?.user?.id),
    getGoalProgress(user.id, new Date().getFullYear()),
    getChallengesWithProgress(user.id),
  ]);

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.username}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-accent-green">
              {user.username[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-sm text-muted">
            {user._count.ratings} rating{user._count.ratings === 1 ? "" : "s"} ·{" "}
            {user._count.watchlist} watchlisted ·{" "}
            {user._count.owned} owned ·{" "}
            {user._count.diaryEntries} logged
          </p>
          <div className="mt-1 flex gap-3 text-xs">
            <Link
              href={`/profile/${username}/diary`}
              className="text-accent-green hover:underline"
            >
              Diary
            </Link>
            <Link
              href={`/profile/${username}/stats`}
              className="text-accent-green hover:underline"
            >
              Stats
            </Link>
            <Link
              href={`/profile/${username}/year`}
              className="text-accent-green hover:underline"
            >
              Year in Review
            </Link>
            {isOwnProfile && (
              <Link href="/challenges" className="text-accent-green hover:underline">
                Challenges
              </Link>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="ml-auto flex gap-2">
            <Link
              href="/settings"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/streaming"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors"
            >
              Streaming Services
            </Link>
            <Link
              href="/import"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent-green transition-colors"
            >
              Import from Letterboxd
            </Link>
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="mb-8 rounded-lg border border-border bg-surface p-4">
          <LetterboxdSyncCard
            initialUsername={user.letterboxdUsername}
            initialSyncedAt={user.letterboxdSyncedAt?.toISOString() ?? null}
          />
        </div>
      )}

      {(goal.target != null || challenges.length > 0) && (
        <div className="mb-10 space-y-4">
          {goal.target != null && (
            <WatchGoalWidget
              year={goal.year}
              target={goal.target}
              count={goal.count}
              percent={goal.percent}
              isOwner={isOwnProfile}
              username={username}
            />
          )}
          {challenges.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recently logged</h2>
        <SortChips
          options={(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
            key,
            label: SORT_OPTIONS[key].label,
          }))}
          activeKey={sortKey}
          activeDir={sortDir}
          hrefFor={(key, nextDir) => buildHref(username, key, nextDir)}
        />
      </div>

      <RecentlyLoggedRow
        entries={recentEntries.map((e) => ({
          id: e.movie.id,
          tmdbId: e.movie.tmdbId,
          title: e.movie.title,
          posterPath: posterOverrides.get(e.movie.tmdbId) ?? e.movie.posterPath,
          year: e.movie.releaseDate?.slice(0, 4),
          score: e.score,
          logCount: e.logCount,
          owned: viewerOwnedIds.has(e.movie.tmdbId),
          inWatchlist: viewerWatchlistIds.has(e.movie.tmdbId),
        }))}
      />

      <div className="mt-10">
        <MovieRow
          title="Owned movies"
          emptyMessage="No owned movies marked yet."
          ownedIds={[...viewerOwnedIds]}
          watchlistIds={[...viewerWatchlistIds]}
          headerExtra={isOwnProfile && <OwnedImportForm />}
          movies={user.owned.map(
            (o): TmdbMovieSummary => ({
              id: o.movie.tmdbId,
              title: o.movie.title,
              overview: "",
              poster_path: posterOverrides.get(o.movie.tmdbId) ?? o.movie.posterPath,
              backdrop_path: null,
              release_date: o.movie.releaseDate ?? "",
              vote_average: 0,
            })
          )}
        />
      </div>
    </div>
  );
}
