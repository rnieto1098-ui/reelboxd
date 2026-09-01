import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { MovieCard } from "@/components/MovieCard";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { compareNullableNumbers, type SortDir } from "@/lib/sortComparator";
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
  const [posterOverrides, viewerOwnedIds, viewerWatchlistIds] = await Promise.all([
    getCustomPosterMap(session?.user?.id, [
      ...recentEntries.map((e) => e.movie.tmdbId),
      ...user.owned.map((o) => o.movie.tmdbId),
    ]),
    getUserOwnedTmdbIds(session?.user?.id),
    getUserWatchlistedTmdbIds(session?.user?.id),
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
        <div className="mb-8 flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4">
          <div>
            <p className="mb-1.5 text-xs text-muted">Profile picture</p>
            <ProfileImageUpload type="avatar" label="Upload photo" hasImage={!!user.image} />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">Site background</p>
            <ProfileImageUpload
              type="background"
              label="Upload background"
              hasImage={!!user.backgroundImage}
            />
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recently logged</h2>
        <div className="flex gap-1 text-xs">
          {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => {
            const isActive = sortKey === key;
            // Clicking the already-active sort flips its direction;
            // clicking a different one starts it at the default direction.
            const nextDir: SortDir = isActive ? (sortDir === "desc" ? "asc" : "desc") : "desc";
            return (
              <Link
                key={key}
                href={buildHref(username, key, nextDir)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  isActive ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
                }`}
              >
                {SORT_OPTIONS[key].label}
                {isActive && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      <HorizontalScroller
        isEmpty={recentEntries.length === 0}
        emptyMessage="Nothing logged or rated yet."
      >
        {recentEntries.map((e) => (
          <div key={e.movie.id} className="w-24 flex-shrink-0 sm:w-28">
            <MovieCard
              tmdbId={e.movie.tmdbId}
              title={e.movie.title}
              posterPath={posterOverrides.get(e.movie.tmdbId) ?? e.movie.posterPath}
              year={e.movie.releaseDate?.slice(0, 4)}
              owned={viewerOwnedIds.has(e.movie.tmdbId)}
              inWatchlist={viewerWatchlistIds.has(e.movie.tmdbId)}
            />
            <p className="mt-1 text-xs text-accent-green">
              {e.score != null ? `${e.score.toFixed(1)} ★` : "Logged"}
              {e.logCount > 1 ? ` · ${e.logCount}×` : ""}
            </p>
          </div>
        ))}
      </HorizontalScroller>

      <div className="mt-10">
        <HorizontalScroller
          title="Owned movies"
          isEmpty={user.owned.length === 0}
          emptyMessage="No owned movies marked yet."
        >
          {user.owned.map((o) => (
            <div key={o.id} className="w-24 flex-shrink-0 sm:w-28">
              <MovieCard
                tmdbId={o.movie.tmdbId}
                title={o.movie.title}
                posterPath={posterOverrides.get(o.movie.tmdbId) ?? o.movie.posterPath}
                year={o.movie.releaseDate?.slice(0, 4)}
                owned={viewerOwnedIds.has(o.movie.tmdbId)}
                inWatchlist={viewerWatchlistIds.has(o.movie.tmdbId)}
              />
            </div>
          ))}
        </HorizontalScroller>
      </div>
    </div>
  );
}
