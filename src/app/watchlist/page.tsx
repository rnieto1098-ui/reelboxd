import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getFlatrateProviders,
  getUserOwnedTmdbIds,
  getUserProviderIds,
  isAvailableOnServices,
} from "@/lib/streaming";
import type { TmdbWatchProvider } from "@/lib/tmdb";
import { MovieCard } from "@/components/MovieCard";
import { ProviderLogos } from "@/components/ProviderLogos";

const TABS = {
  available: { label: "Streaming on your services" },
  unavailable: { label: "Not on your services yet" },
} satisfies Record<string, { label: string }>;

type TabKey = keyof typeof TABS;

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { tab } = await searchParams;
  const activeTab: TabKey = tab === "unavailable" ? "unavailable" : "available";

  const [items, userProviderIds, ownedTmdbIds] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      include: {
        movie: {
          include: { customPosters: { where: { userId: session.user.id } } },
        },
      },
      orderBy: { addedAt: "desc" },
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
  // Owning a movie makes it watchable right now, same as a subscription
  // service does — someone with no services but a few owned movies should
  // still get a meaningful split instead of the flat "add your services" view.
  const canSplit = hasServicesConfigured || ownedTmdbIds.size > 0;
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
                    href={key === "available" ? "/watchlist" : "/watchlist?tab=unavailable"}
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
