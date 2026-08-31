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
import { MovieCard } from "@/components/MovieCard";
import { ProviderLogos } from "@/components/ProviderLogos";
import type { Prisma } from "@prisma/client";

const TABS = {
  available: { label: "Streaming on your services" },
  unavailable: { label: "Not on your services yet" },
} satisfies Record<string, { label: string }>;

type TabKey = keyof typeof TABS;

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
type SortDir = "asc" | "desc";

function buildHref(sortKey: SortKey, dir: SortDir, tab: TabKey) {
  const params = new URLSearchParams();
  if (sortKey !== "added") params.set("sort", sortKey);
  if (dir !== "desc") params.set("dir", dir);
  if (tab !== "available") params.set("tab", tab);
  const qs = params.toString();
  return `/watchlist${qs ? `?${qs}` : ""}`;
}

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { tab, sort, dir } = await searchParams;
  const activeTab: TabKey = tab === "unavailable" ? "unavailable" : "available";
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

  const withAvailability = await Promise.all(
    items.map(async (item) => ({
      item,
      providers: ownedTmdbIds.has(item.movie.tmdbId)
        ? []
        : await getFlatrateProviders(item.movie.tmdbId),
      owned: ownedTmdbIds.has(item.movie.tmdbId),
    }))
  );

  const hasServicesConfigured = userProviderIds.size > 0;
  const canSplit = hasStreamingAvailability(userProviderIds, ownedTmdbIds);
  const isAvailable = ({ providers, owned }: { providers: TmdbWatchProvider[]; owned: boolean }) =>
    owned || isAvailableOnServices(providers, userProviderIds);
  const streamingNow = withAvailability.filter(isAvailable);
  const notStreaming = withAvailability.filter((entry) => !isAvailable(entry));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Watchlist</h1>
        <Link
          href="/streaming"
          className="text-sm text-muted hover:text-accent-green hover:underline"
        >
          {hasServicesConfigured ? "Edit your streaming services" : "Add your streaming services"}
        </Link>
      </div>

      {items.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-1 text-xs">
          <span className="mr-1 text-muted">Sort:</span>
          {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => {
            const isActive = sortKey === key;
            // Clicking the already-active sort flips its direction;
            // clicking a different one starts it at the default direction.
            const nextDir: SortDir = isActive ? (sortDir === "desc" ? "asc" : "desc") : "desc";
            return (
              <Link
                key={key}
                href={buildHref(key, nextDir, activeTab)}
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
      )}

      {items.length === 0 ? (
        <p className="text-muted">
          Nothing here yet. Find a movie and click &ldquo;+ Watchlist&rdquo; to add it.
        </p>
      ) : !canSplit ? (
        <>
          <p className="mb-6 text-sm text-muted">
            <Link href="/streaming" className="text-accent-green hover:underline">
              Add the streaming services you subscribe to
            </Link>{" "}
            (or mark movies as owned) and we&apos;ll split this list into what you can watch right
            now and what you can&apos;t.
          </p>
          <WatchlistGrid entries={withAvailability} />
        </>
      ) : (
        <div>
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-full border border-border bg-surface p-1">
              {(Object.keys(TABS) as TabKey[]).map((key) => {
                const count = key === "available" ? streamingNow.length : notStreaming.length;
                return (
                  <Link
                    key={key}
                    href={buildHref(sortKey, sortDir, key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === key
                        ? "bg-accent-green text-black"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {TABS[key].label} <span className="opacity-70">({count})</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {activeTab === "available" ? (
            streamingNow.length === 0 ? (
              <p className="text-sm text-muted">
                None of your watchlist is currently on your services or owned.
              </p>
            ) : (
              <WatchlistGrid entries={streamingNow} />
            )
          ) : notStreaming.length === 0 ? (
            <p className="text-sm text-muted">Everything on your watchlist is covered.</p>
          ) : (
            <WatchlistGrid entries={notStreaming} />
          )}
        </div>
      )}
    </div>
  );
}

function WatchlistGrid({
  entries,
}: {
  entries: {
    item: {
      id: string;
      movie: {
        tmdbId: number;
        title: string;
        posterPath: string | null;
        releaseDate: string | null;
        customPosters: { posterPath: string }[];
      };
    };
    providers: { provider_id: number; provider_name: string; logo_path: string }[];
    owned?: boolean;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {entries.map(({ item, providers, owned }) => (
        <div key={item.id}>
          <MovieCard
            tmdbId={item.movie.tmdbId}
            title={item.movie.title}
            posterPath={item.movie.customPosters[0]?.posterPath ?? item.movie.posterPath}
            year={item.movie.releaseDate?.slice(0, 4)}
            owned={owned}
            inWatchlist
          />
          {owned ? (
            <span className="mt-1 inline-block rounded-full border border-accent-green px-2 py-0.5 text-xs text-accent-green">
              Owned
            </span>
          ) : (
            <ProviderLogos providers={providers} />
          )}
        </div>
      ))}
    </div>
  );
}
