import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { getGoalProgress } from "@/lib/goals";
import { getChallengesWithProgress } from "@/lib/challenges";
import { MovieRow } from "@/components/MovieRow";
import { RecentlyLoggedRow } from "@/components/RecentlyLoggedRow";
import { SortChips } from "@/components/SortChips";
import { WatchGoalWidget } from "@/components/WatchGoalWidget";
import { ChallengeCard } from "@/components/ChallengeCard";
import { LetterboxdSyncCard } from "@/components/LetterboxdSyncCard";
import { OwnedImportForm } from "@/components/OwnedImportForm";
import { compareNullableNumbers, type SortDir } from "@/lib/sortComparator";
import type { TmdbMovieSummary } from "@/lib/tmdb";
import type { Movie } from "@prisma/client";
import { currentYearUTC } from "@/lib/dates";
import { avatarSrc } from "@/lib/avatars";

const SORT_OPTIONS = {
  recent: { label: "Recently Logged" },
  rating: { label: "Your Rating" },
  release: { label: "Release Date" },
  popularity: { label: "Popularity" },
} satisfies Record<string, { label: string }>;

type SortKey = keyof typeof SORT_OPTIONS;

// How many movies "Recently logged" and "Owned movies" show before the row
// runs out of content to scroll through. 24 turned out too small in
// practice — at typical screen widths each arrow click scrolls ~90% of the
// visible row, so 24 items (roughly 2-2.5 screens wide) hit the end after
// only two clicks, which reads as "scrolling is broken" rather than "you've
// seen everything." Bumped well past that so scrolling has real room, while
// staying bounded (these are activity previews, not the full archive).
const ROW_PREVIEW_LIMIT = 60;

// A movie can be rated, logged (diary), or both — this merges the two into
// one row per movie so "Recently Logged" reflects everything you've watched,
// not just what you got around to rating.
type RecentEntry = {
  movie: Movie;
  score: number | null;
  logCount: number;
  lastActivityAt: number;
};

/**
 * How to order each candidate fetch so its first page contains the rows that
 * will actually survive `sortEntries` below.
 *
 * "rating" is the asymmetric one: only the Rating table carries a score, so
 * the diary side has no meaningful order to contribute and just supplies the
 * unrated tail — which `compareNullableNumbers` parks at the end regardless
 * of direction, exactly as it did when this read the whole history.
 */
function candidateOrder(sortKey: SortKey, dir: SortDir) {
  if (sortKey === "rating") {
    return { rating: { score: dir }, diary: { watchedDate: "desc" as const } };
  }
  if (sortKey === "release") {
    return { rating: { movie: { releaseDate: dir } }, diary: { movie: { releaseDate: dir } } };
  }
  if (sortKey === "popularity") {
    return { rating: { movie: { popularity: dir } }, diary: { movie: { popularity: dir } } };
  }
  return { rating: { createdAt: dir }, diary: { watchedDate: dir } };
}

function sortEntries(entries: RecentEntry[], sortKey: SortKey, dir: SortDir): RecentEntry[] {
  const valueOf = (e: RecentEntry): number | null => {
    if (sortKey === "recent") return e.lastActivityAt;
    if (sortKey === "rating") return e.score;
    if (sortKey === "release") return e.movie.releaseDate ? Date.parse(e.movie.releaseDate) : null;
    return e.movie.popularity;
  };
  return [...entries].sort((a, b) => compareNullableNumbers(valueOf(a), valueOf(b), dir));
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

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      owned: {
        include: { movie: true },
        orderBy: { addedAt: "desc" },
        take: ROW_PREVIEW_LIMIT,
      },
      _count: {
        select: { ratings: true, watchlist: true, owned: true, diaryEntries: true },
      },
    },
  });

  if (!user) notFound();

  // Compared by id, like every other ownership check in the app (the diary
  // page, lists, challenges). This used to compare session.user.name against
  // the URL's username, which reads the JWT's cached name — stale after a
  // rename until the session is reissued, so the owner of a just-renamed
  // profile could look at their own page and be treated as a stranger.
  const isOwnProfile = session?.user?.id === user.id;

  // Candidates for the row, pulled in the active sort's own order so the
  // top slice can be taken without reading the whole history. This page used
  // to include every rating and every diary entry the user had ever made,
  // each joined to its full Movie row, only to slice 60 items out of them in
  // JS — the one page in the app that grows without bound as an account ages,
  // on the URL most likely to be opened by someone else.
  //
  // Taking ROW_PREVIEW_LIMIT from each table is enough to be correct: a movie
  // in the true top N is there because of a rating or a log, and that row has
  // to be within its own table's top N by the same key. Rewatches are the one
  // wrinkle — several rows can collapse to one movie — so the diary side
  // fetches double to leave headroom rather than paying for a `distinct` that
  // this connector applies in memory anyway.
  const order = candidateOrder(sortKey, sortDir);
  const [ratingCandidates, diaryCandidates] = await Promise.all([
    prisma.rating.findMany({
      where: { userId: user.id },
      include: { movie: true },
      orderBy: order.rating,
      take: ROW_PREVIEW_LIMIT,
    }),
    prisma.diaryEntry.findMany({
      where: { userId: user.id },
      include: { movie: true },
      orderBy: order.diary,
      take: ROW_PREVIEW_LIMIT * 2,
    }),
  ]);

  const byMovie = new Map<string, RecentEntry>();
  for (const r of ratingCandidates) {
    byMovie.set(r.movieId, {
      movie: r.movie,
      score: r.score,
      logCount: 0,
      lastActivityAt: r.createdAt.getTime(),
    });
  }
  for (const d of diaryCandidates) {
    if (!byMovie.has(d.movieId)) {
      byMovie.set(d.movieId, { movie: d.movie, score: null, logCount: 0, lastActivityAt: 0 });
    }
  }

  // The candidate fetches answer "which movies", not "what are their totals":
  // a film can surface on the diary side while its rating sits outside the
  // rating slice (or the reverse), and a rewatch count can't be read off a
  // truncated list at all. Both are filled in exactly here, for the candidate
  // set only, so the badges match what a full scan would have said.
  const candidateMovieIds = [...byMovie.keys()];
  const [exactRatings, exactLogs] = await Promise.all([
    prisma.rating.findMany({
      where: { userId: user.id, movieId: { in: candidateMovieIds } },
      select: { movieId: true, score: true, createdAt: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: user.id, movieId: { in: candidateMovieIds } },
      select: { movieId: true, watchedDate: true },
    }),
  ]);
  for (const r of exactRatings) {
    const entry = byMovie.get(r.movieId);
    if (!entry) continue;
    entry.score = r.score;
    entry.lastActivityAt = Math.max(entry.lastActivityAt, r.createdAt.getTime());
  }
  for (const d of exactLogs) {
    const entry = byMovie.get(d.movieId);
    if (!entry) continue;
    entry.logCount++;
    entry.lastActivityAt = Math.max(entry.lastActivityAt, d.watchedDate.getTime());
  }

  const recentEntries = sortEntries([...byMovie.values()], sortKey, sortDir).slice(0, ROW_PREVIEW_LIMIT);

  // Use the viewer's own poster choices, not the profile owner's — a custom
  // poster is a personal preference that follows you wherever a film shows up.
  // Same reasoning for owned/watchlist highlighting below: it reflects
  // whoever is looking, not necessarily this profile's owner.
  const [posterOverrides, viewerOwnedIds, viewerWatchlistIds, viewerWatchedIds, goal, challenges] =
    await Promise.all([
      getCustomPosterMap(session?.user?.id, [
        ...recentEntries.map((e) => e.movie.tmdbId),
        ...user.owned.map((o) => o.movie.tmdbId),
      ]),
      getUserOwnedTmdbIds(session?.user?.id),
      getUserWatchlistedTmdbIds(session?.user?.id),
      // Owned movies are plausibly already watched, unlike a recommendation
      // row — the "Owned movies" MovieRow below needs this to show the
      // right state, same convention as the dedicated /owned page.
      getWatchedTmdbIds(session?.user?.id),
      getGoalProgress(user.id, currentYearUTC()),
      getChallengesWithProgress(user.id),
    ]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
          <Image
            src={avatarSrc(user.image, user.username)}
            alt={user.username}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h1 className="page-title">{user.username}</h1>
          <p className="text-sm text-muted">
            {user._count.ratings} rating{user._count.ratings === 1 ? "" : "s"} ·{" "}
            {user._count.watchlist} watchlisted ·{" "}
            {user._count.owned} owned ·{" "}
            {user._count.diaryEntries} logged
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link
              href={`/profile/${username}/films`}
              className="chip hover:border-accent-green hover:text-accent-green"
            >
              Films
            </Link>
            <Link
              href={`/profile/${username}/diary`}
              className="chip hover:border-accent-green hover:text-accent-green"
            >
              Diary
            </Link>
            <Link
              href={`/profile/${username}/stats`}
              className="chip hover:border-accent-green hover:text-accent-green"
            >
              Stats
            </Link>
            <Link
              href={`/profile/${username}/year`}
              className="chip hover:border-accent-green hover:text-accent-green"
            >
              Year in Review
            </Link>
            {isOwnProfile && (
              <Link href="/challenges" className="chip hover:border-accent-green hover:text-accent-green">
                Challenges
              </Link>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <Link
              href="/rewatch"
              className="btn btn-outline btn-sm"
            >
              Rewatch List
            </Link>
            <Link
              href="/settings"
              className="btn btn-outline btn-sm"
            >
              Settings
            </Link>
            <Link
              href="/streaming"
              className="btn btn-outline btn-sm"
            >
              Streaming Services
            </Link>
            <Link
              href="/import"
              className="btn btn-outline btn-sm"
            >
              Import from Letterboxd
            </Link>
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="card mb-8 p-5">
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
              pace={goal.pace}
              isOwner={isOwnProfile}
              username={username}
            />
          )}
          {challenges.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} canEdit={false} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Recently logged</h2>
          {recentEntries.length > 0 && (
            <Link
              href={`/profile/${username}/diary`}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              View all
            </Link>
          )}
        </div>
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
          watched: viewerWatchedIds.has(e.movie.tmdbId),
        }))}
      />

      <div className="mt-10">
        <MovieRow
          title="Owned movies"
          emptyMessage="No owned movies marked yet."
          ownedIds={[...viewerOwnedIds]}
          watchlistIds={[...viewerWatchlistIds]}
          watchedIds={[...viewerWatchedIds]}
          headerExtra={
            (isOwnProfile || user.owned.length > 0) && (
              <>
                {isOwnProfile && <OwnedImportForm />}
                {user.owned.length > 0 && (
                  <Link
                    href={`/profile/${username}/owned`}
                    className="text-xs text-muted hover:text-foreground hover:underline"
                  >
                    View all
                  </Link>
                )}
              </>
            )
          }
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
