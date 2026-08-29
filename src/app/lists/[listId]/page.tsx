import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { posterUrl } from "@/lib/tmdb";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getPersonalListCover } from "@/lib/listCovers";
import { filterMoviesByStreaming, getUserOwnedTmdbIds, getUserProviderIds } from "@/lib/streaming";
import { MovieCard } from "@/components/MovieCard";
import { RemoveFromListButton } from "@/components/RemoveFromListButton";
import { DeleteListButton } from "@/components/DeleteListButton";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";
import { ListCoverUpload } from "@/components/ListCoverUpload";

const SORT_OPTIONS = {
  order: { label: "List Order" },
  release: { label: "Release Date" },
  popularity: { label: "Popularity" },
  rating: { label: "Your Rating" },
} satisfies Record<string, { label: string }>;

type SortKey = keyof typeof SORT_OPTIONS;
type SortDir = "asc" | "desc";
type ListItemRow = {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  popularity: number | null;
};

function sortItems(
  items: ListItemRow[],
  sortKey: SortKey,
  dir: SortDir,
  ratingMap: Map<number, number>
) {
  if (sortKey === "order") {
    // "desc" is the list's natural (curated/rank) order; "asc" flips it.
    return dir === "asc" ? [...items].reverse() : items;
  }

  const valueOf = (item: ListItemRow): number | null => {
    if (sortKey === "release") {
      return item.releaseDate ? new Date(item.releaseDate).getTime() : null;
    }
    if (sortKey === "popularity") return item.popularity;
    return ratingMap.get(item.tmdbId) ?? null;
  };

  // Highest first by default; items missing the sorted-on value always sort
  // to the end regardless of direction, so reversing never buries real data
  // under a pile of unrated/unpopular-data movies.
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (vb - va) * sign;
  });
}

function buildHref(listId: string, sortKey: SortKey, dir: SortDir, streamingOnly: boolean) {
  const params = new URLSearchParams();
  if (sortKey !== "order") params.set("sort", sortKey);
  if (dir !== "desc") params.set("dir", dir);
  if (streamingOnly) params.set("streaming", "1");
  const qs = params.toString();
  return `/lists/${listId}${qs ? `?${qs}` : ""}`;
}

export default async function ListDetailPage({
  params,
  searchParams,
}: PageProps<"/lists/[listId]">) {
  const { listId } = await params;
  const { sort, dir, streaming } = await searchParams;
  const sortKey: SortKey = typeof sort === "string" && sort in SORT_OPTIONS ? (sort as SortKey) : "order";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  const streamingOnly = streaming === "1";

  const session = await auth();
  const userId = session?.user?.id;

  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: {
      owner: { select: { username: true } },
      items: { orderBy: { position: "asc" } },
    },
  });

  if (!list) notFound();

  const isOwner = !!userId && list.ownerId === userId;

  const [ratingMap, userProviderIds, ownedTmdbIds, personalCover] = await Promise.all([
    userId && list.items.length > 0
      ? prisma.rating
          .findMany({
            where: { userId, movie: { tmdbId: { in: list.items.map((i) => i.tmdbId) } } },
            select: { score: true, movie: { select: { tmdbId: true } } },
          })
          .then((rows) => new Map(rows.map((r) => [r.movie.tmdbId, r.score])))
      : Promise.resolve(new Map<number, number>()),
    getUserProviderIds(userId),
    getUserOwnedTmdbIds(userId),
    getPersonalListCover(userId, listId),
  ]);

  // ratingMap is already scoped to exactly this list's tmdbIds — a rating
  // there means "watched," same convention as everywhere else in the app.
  const watchedPercent =
    userId && list.items.length > 0 ? Math.round((ratingMap.size / list.items.length) * 100) : null;

  const coverSrc =
    personalCover ?? list.coverImage ?? posterUrl(list.items[0]?.posterPath ?? null, "w200");

  const hasServicesConfigured = userProviderIds.size > 0;
  // Owning a movie makes it watchable right now, same as a subscription
  // service does — someone with no services but a few owned movies should
  // still be able to use "On my streaming services" meaningfully.
  const canFilterByAvailability = hasServicesConfigured || ownedTmdbIds.size > 0;
  const applyStreamingFilter = streamingOnly && canFilterByAvailability;

  const filteredItems = applyStreamingFilter
    ? await filterMoviesByStreaming(
        list.items.map((item) => ({ id: item.tmdbId, item })),
        userProviderIds,
        ownedTmdbIds
      ).then((kept) => kept.map((k) => k.item))
    : list.items;

  const sortedItems = sortItems(filteredItems, sortKey, sortDir, ratingMap);

  const posterOverrides = await getCustomPosterMap(
    userId,
    sortedItems.map((i) => i.tmdbId)
  );

  const grid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
      {sortedItems.map((item) => (
        <div key={item.id} data-watched={ratingMap.has(item.tmdbId)}>
          <MovieCard
            tmdbId={item.tmdbId}
            title={item.title}
            posterPath={posterOverrides.get(item.tmdbId) ?? item.posterPath}
            year={item.releaseDate?.slice(0, 4)}
          />
          {isOwner && <RemoveFromListButton listId={list.id} tmdbId={item.tmdbId} />}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="hidden h-32 w-[5.5rem] shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:block">
            {coverSrc ? (
              <Image
                src={coverSrc}
                alt={list.title}
                width={160}
                height={240}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-muted">
                {list.title}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{list.title}</h1>
            <p className="text-sm text-muted">
              {list.isSystem ? "Curated by reelboxd" : `By ${list.owner?.username}`} ·{" "}
              {list.items.length} movie{list.items.length === 1 ? "" : "s"}
            </p>
            {list.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted">{list.description}</p>
            )}
            {watchedPercent != null && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3.5 w-3.5 text-accent-green"
                >
                  <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>
                  {watchedPercent}% watched ({ratingMap.size}/{list.items.length})
                </span>
              </div>
            )}
            {isOwner && (
              <div className="mt-3">
                <ListCoverUpload
                  endpoint={`/api/lists/${list.id}/cover`}
                  hasImage={!!list.coverImage}
                  addLabel="Add cover image"
                  changeLabel="Change cover image"
                />
              </div>
            )}
            {userId && (
              <div className="mt-3">
                <ListCoverUpload
                  endpoint={`/api/lists/${list.id}/my-cover`}
                  hasImage={!!personalCover}
                  addLabel="Set your own cover (only you'll see it)"
                  changeLabel="Change your cover (only you'll see it)"
                />
              </div>
            )}
          </div>
        </div>
        {isOwner && <DeleteListButton listId={list.id} />}
      </div>

      {list.items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="mr-1 text-muted">Sort:</span>
            {(Object.keys(SORT_OPTIONS) as SortKey[])
              .filter((key) => key !== "rating" || userId)
              .map((key) => {
                const isActive = sortKey === key;
                // Clicking the already-active sort flips its direction;
                // clicking a different one starts it at the default direction.
                const nextDir: SortDir = isActive ? (sortDir === "desc" ? "asc" : "desc") : "desc";
                return (
                  <Link
                    key={key}
                    href={buildHref(listId, key, nextDir, streamingOnly)}
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

          {session?.user && (
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="mr-1 text-muted">Showing:</span>
              <Link
                href={buildHref(listId, sortKey, sortDir, false)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  !streamingOnly ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
                }`}
              >
                All movies
              </Link>
              <Link
                href={buildHref(listId, sortKey, sortDir, true)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  streamingOnly ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
                }`}
              >
                On my streaming services
              </Link>
              {streamingOnly && !canFilterByAvailability && (
                <span className="text-muted">
                  You haven&apos;t added any services or marked anything as owned yet —{" "}
                  <Link href="/streaming" className="text-accent-green hover:underline">
                    add your services here
                  </Link>
                  .
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {list.items.length === 0 ? (
        <p className="text-muted">No movies in this list yet.</p>
      ) : sortedItems.length === 0 ? (
        <p className="text-muted">None of these are on your streaming services or owned right now.</p>
      ) : userId ? (
        <FadeWatchedControl>{grid}</FadeWatchedControl>
      ) : (
        grid
      )}
    </div>
  );
}
