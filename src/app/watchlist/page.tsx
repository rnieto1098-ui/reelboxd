import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getFlatrateProviders,
  getUserOwnedTmdbIds,
  getUserProviderIds,
  hasStreamingAvailability,
  isAvailableOnServices,
} from "@/lib/streaming";
import type { TmdbWatchProvider } from "@/lib/tmdb";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import { WatchlistImportForm } from "@/components/WatchlistImportForm";
import { AvailabilityFilterLinks } from "@/components/AvailabilityFilterLinks";
import { SortChips } from "@/components/SortChips";
import type { SortDir } from "@/lib/sortComparator";
import type { Prisma } from "@prisma/client";

const SORT_OPTIONS = {
  added: { label: "Date Added", orderBy: (dir: Prisma.SortOrder) => ({ addedAt: dir }) },
  release: {
    label: "Release Date",
    orderBy: (dir: Prisma.SortOrder) => ({ movie: { releaseDate: dir } }),
  },
  popularity: {
    label: "Popularity",
    orderBy: (dir: Prisma.SortOrder) => ({ movie: { popularity: dir } }),
  },
  runtime: { label: "Runtime", orderBy: (dir: Prisma.SortOrder) => ({ movie: { runtime: dir } }) },
  rating: {
    label: "TMDB Rating",
    orderBy: (dir: Prisma.SortOrder) => ({ movie: { voteAverage: dir } }),
  },
} satisfies Record<
  string,
  { label: string; orderBy: (dir: Prisma.SortOrder) => Prisma.WatchlistItemOrderByWithRelationInput }
>;

type SortKey = keyof typeof SORT_OPTIONS;

// TMDB has no batch watch-providers endpoint, so this is one request per
// non-owned item — chunked (rather than one giant Promise.all) so a large
// watchlist doesn't create hundreds of pending promises at once. The actual
// network throttling happens one level down, in tmdbFetch's own concurrency
// queue; this just keeps this page's own fan-out sane on top of that.
const PROVIDER_LOOKUP_CONCURRENCY = 6;

function buildHref(sortKey: SortKey, dir: SortDir, streamingOnly: boolean) {
  const params = new URLSearchParams();
  if (sortKey !== "added") params.set("sort", sortKey);
  if (dir !== "desc") params.set("dir", dir);
  if (streamingOnly) params.set("streaming", "1");
  const qs = params.toString();
  return `/watchlist${qs ? `?${qs}` : ""}`;
}

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { streaming, sort, dir } = await searchParams;
  const streamingOnly = streaming === "1";
  const sortKey: SortKey = typeof sort === "string" && sort in SORT_OPTIONS ? (sort as SortKey) : "added";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";

  const [items, userProviderIds, ownedTmdbIds] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      include: {
        movie: {
          include: { customPosters: { where: { userId: session.user.id } } },
        },
      },
      orderBy: SORT_OPTIONS[sortKey].orderBy(sortDir),
    }),
    getUserProviderIds(session.user.id),
    getUserOwnedTmdbIds(session.user.id),
  ]);

  const withAvailability: {
    item: (typeof items)[number];
    providers: TmdbWatchProvider[];
    owned: boolean;
  }[] = [];
  for (let i = 0; i < items.length; i += PROVIDER_LOOKUP_CONCURRENCY) {
    const batch = items.slice(i, i + PROVIDER_LOOKUP_CONCURRENCY);
    const providerLists = await Promise.all(
      batch.map((item) =>
        ownedTmdbIds.has(item.movie.tmdbId) ? Promise.resolve([]) : getFlatrateProviders(item.movie.tmdbId)
      )
    );
    batch.forEach((item, idx) => {
      withAvailability.push({
        item,
        providers: providerLists[idx],
        owned: ownedTmdbIds.has(item.movie.tmdbId),
      });
    });
  }

  const hasServicesConfigured = userProviderIds.size > 0;
  const canFilterByAvailability = hasStreamingAvailability(userProviderIds, ownedTmdbIds);
  const applyStreamingFilter = streamingOnly && canFilterByAvailability;
  const isAvailable = ({ providers, owned }: { providers: TmdbWatchProvider[]; owned: boolean }) =>
    owned || isAvailableOnServices(providers, userProviderIds);
  const visibleEntries = applyStreamingFilter
    ? withAvailability.filter(isAvailable)
    : withAvailability;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Your Watchlist</h1>
        <div className="flex items-center gap-4">
          <WatchlistImportForm />
          <Link
            href="/streaming"
            className="text-sm text-muted hover:text-accent-green hover:underline"
          >
            {hasServicesConfigured ? "Edit your streaming services" : "Add your streaming services"}
          </Link>
        </div>
      </div>

      {items.length > 0 && (
        <AvailabilityFilterLinks
          allHref={buildHref(sortKey, sortDir, false)}
          streamingHref={buildHref(sortKey, sortDir, true)}
          streamingOnly={streamingOnly}
          canFilterByAvailability={canFilterByAvailability}
          className="mb-6"
        />
      )}

      {items.length > 1 && (
        <div className="mb-6">
          <SortChips
            options={(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
              key,
              label: SORT_OPTIONS[key].label,
            }))}
            activeKey={sortKey}
            activeDir={sortDir}
            hrefFor={(key, nextDir) => buildHref(key, nextDir, streamingOnly)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted">
          Nothing here yet. Find a movie and click &ldquo;+ Watchlist&rdquo; to add it.
        </p>
      ) : visibleEntries.length === 0 ? (
        <p className="text-sm text-muted">
          None of your watchlist is currently on your services or owned.
        </p>
      ) : (
        <WatchlistGrid entries={visibleEntries} />
      )}
    </div>
  );
}
