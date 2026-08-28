import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { MovieCard } from "@/components/MovieCard";
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import type { Prisma } from "@prisma/client";

const SORT_OPTIONS = {
  recent: { label: "Recently Rated", orderBy: (dir: Prisma.SortOrder) => ({ createdAt: dir }) },
  rating: { label: "Your Rating", orderBy: (dir: Prisma.SortOrder) => ({ score: dir }) },
  release: {
    label: "Release Date",
    orderBy: (dir: Prisma.SortOrder) => ({ movie: { releaseDate: dir } }),
  },
  popularity: {
    label: "Popularity",
    orderBy: (dir: Prisma.SortOrder) => ({ movie: { popularity: dir } }),
  },
} satisfies Record<
  string,
  { label: string; orderBy: (dir: Prisma.SortOrder) => Prisma.RatingOrderByWithRelationInput }
>;

type SortKey = keyof typeof SORT_OPTIONS;
type SortDir = "asc" | "desc";

function buildHref(username: string, key: SortKey, dir: SortDir) {
  const params = new URLSearchParams();
  if (key !== "recent") params.set("sort", key);
  if (dir !== "desc") params.set("dir", dir);
  const qs = params.toString();
  return `/profile/${username}${qs ? `?${qs}` : ""}`;
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
      ratings: {
        include: { movie: true },
        orderBy: SORT_OPTIONS[sortKey].orderBy(sortDir),
        take: 24,
      },
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

  // Use the viewer's own poster choices, not the profile owner's — a custom
  // poster is a personal preference that follows you wherever a film shows up.
  const posterOverrides = await getCustomPosterMap(session?.user?.id, [
    ...user.ratings.map((r) => r.movie.tmdbId),
    ...user.owned.map((o) => o.movie.tmdbId),
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
        <h2 className="text-lg font-semibold">Recently rated</h2>
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
        isEmpty={user.ratings.length === 0}
        emptyMessage="No ratings yet."
      >
        {user.ratings.map((r) => (
          <div key={r.id} className="w-24 flex-shrink-0 sm:w-28">
            <MovieCard
              tmdbId={r.movie.tmdbId}
              title={r.movie.title}
              posterPath={posterOverrides.get(r.movie.tmdbId) ?? r.movie.posterPath}
              year={r.movie.releaseDate?.slice(0, 4)}
            />
            <p className="mt-1 text-xs text-accent-green">{r.score.toFixed(1)} ★</p>
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
              />
            </div>
          ))}
        </HorizontalScroller>
      </div>
    </div>
  );
}
