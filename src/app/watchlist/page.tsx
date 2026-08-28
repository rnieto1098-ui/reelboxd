import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFlatrateProviders, getUserProviderIds, isAvailableOnServices } from "@/lib/streaming";
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

  const [items, userProviderIds] = await Promise.all([
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
  ]);

  const withAvailability = await Promise.all(
    items.map(async (item) => ({
      item,
      providers: await getFlatrateProviders(item.movie.tmdbId),
    }))
  );

  const hasServicesConfigured = userProviderIds.size > 0;
  const streamingNow = withAvailability.filter(({ providers }) =>
    isAvailableOnServices(providers, userProviderIds)
  );
  const notStreaming = withAvailability.filter(
    ({ providers }) => !isAvailableOnServices(providers, userProviderIds)
  );

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
      ) : !hasServicesConfigured ? (
        <>
          <p className="mb-6 text-sm text-muted">
            <Link href="/streaming" className="text-accent-green hover:underline">
              Add the streaming services you subscribe to
            </Link>{" "}
            and we&apos;ll split this list into what you can watch right now and what you can&apos;t.
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
                None of your watchlist is currently on your services.
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
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {entries.map(({ item, providers }) => (
        <div key={item.id}>
          <MovieCard
            tmdbId={item.movie.tmdbId}
            title={item.movie.title}
            posterPath={item.movie.customPosters[0]?.posterPath ?? item.movie.posterPath}
            year={item.movie.releaseDate?.slice(0, 4)}
          />
          <ProviderLogos providers={providers} />
        </div>
      ))}
    </div>
  );
}
