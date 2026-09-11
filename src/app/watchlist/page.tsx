import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getFlatrateProviderIdsByTmdbId,
  getUserOwnedTmdbIds,
  hasStreamingAvailability,
  isAvailableOnServiceIds,
} from "@/lib/streaming";
import { parseGenres } from "@/lib/movies";
import {
  certificationFacets,
  directorFacets,
  genreFacets,
  hasActiveFilters,
  matchesFilters,
  runtimeFacets,
  type FilterableMovie,
  type WatchlistFilters,
} from "@/lib/watchlistFilters";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { WatchlistImportForm } from "@/components/WatchlistImportForm";
import { FilterSelect, type FilterOption } from "@/components/FilterSelect";
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

// The "streaming" dropdown's value: "" (all), "on"/"off" (aggregate across
// every configured service, same meaning as the old pill toggle), "owned",
// or "svc:<providerId>" for one specific service. Kept as one plain string
// rather than a richer type since it only ever needs to round-trip through
// a URL and an <select>'s value.
type AvailMode =
  | { kind: "all" }
  | { kind: "on" }
  | { kind: "off" }
  | { kind: "owned" }
  | { kind: "service"; providerId: number };

function parseAvail(raw: string): AvailMode {
  if (raw === "on") return { kind: "on" };
  if (raw === "off") return { kind: "off" };
  if (raw === "owned") return { kind: "owned" };
  if (raw.startsWith("svc:")) {
    const providerId = Number(raw.slice(4));
    if (Number.isFinite(providerId)) return { kind: "service", providerId };
  }
  return { kind: "all" };
}

// Every piece of state a link on this page might need to preserve or
// override. buildHref takes the current full set plus only the fields one
// specific link wants to change — every filter dropdown and every sort chip
// shares this one function, so changing sort can never silently drop an
// active filter (or vice versa).
type CurrentState = {
  sortKey: SortKey;
  sortDir: SortDir;
  avail: string;
  genre: string | null;
  directorId: number | null;
  runtimeBucket: string | null;
  certification: string | null;
};

function buildHref(current: CurrentState, overrides: Partial<CurrentState>): string {
  const s = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (s.sortKey !== "added") params.set("sort", s.sortKey);
  if (s.sortDir !== "desc") params.set("dir", s.sortDir);
  if (s.avail) params.set("avail", s.avail);
  if (s.genre) params.set("genre", s.genre);
  if (s.directorId != null) params.set("director", String(s.directorId));
  if (s.runtimeBucket) params.set("runtime", s.runtimeBucket);
  if (s.certification) params.set("cert", s.certification);
  const qs = params.toString();
  return `/watchlist${qs ? `?${qs}` : ""}`;
}

function toFilterableMovie(movie: {
  runtime: number | null;
  genres: string | null;
  directorId: number | null;
  directorName: string | null;
  certification: string | null;
}): FilterableMovie {
  return {
    runtime: movie.runtime,
    genres: parseGenres(movie.genres),
    directorId: movie.directorId,
    directorName: movie.directorName,
    certification: movie.certification,
  };
}

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { sort, dir, avail, genre, director, runtime, cert } = await searchParams;
  const sortKey: SortKey = typeof sort === "string" && sort in SORT_OPTIONS ? (sort as SortKey) : "added";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  const availRaw = typeof avail === "string" ? avail : "";
  const directorId =
    typeof director === "string" && Number.isFinite(Number(director)) ? Number(director) : null;

  const current: CurrentState = {
    sortKey,
    sortDir,
    avail: availRaw,
    genre: typeof genre === "string" && genre ? genre : null,
    directorId,
    runtimeBucket: typeof runtime === "string" && runtime ? runtime : null,
    certification: typeof cert === "string" && cert ? cert : null,
  };
  const attributeFilters: WatchlistFilters = {
    genre: current.genre,
    directorId: current.directorId,
    runtimeBucket: current.runtimeBucket,
    certification: current.certification,
  };

  const [items, userServices, ownedTmdbIds, watchedTmdbIds] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      include: {
        movie: {
          include: { customPosters: { where: { userId: session.user.id } } },
        },
      },
      orderBy: SORT_OPTIONS[sortKey].orderBy(sortDir),
    }),
    prisma.streamingService.findMany({
      where: { userId: session.user.id },
      select: { providerId: true, providerName: true },
    }),
    getUserOwnedTmdbIds(session.user.id),
    // Almost always empty here — logging, rating, or marking a film watched
    // already drops it from the watchlist — but a rewatch can be re-added
    // afterward, so this can't just be assumed false.
    getWatchedTmdbIds(session.user.id),
  ]);

  const userProviderIds = new Set(userServices.map((s) => s.providerId));

  // One snapshot query for the whole list instead of a TMDB request per
  // item — see getFlatrateProviderIdsByTmdbId. Owned films skip the lookup
  // entirely, since owning one already makes it available regardless.
  const providerIdsByTmdbId = await getFlatrateProviderIdsByTmdbId(
    items.filter((i) => !ownedTmdbIds.has(i.movie.tmdbId)).map((i) => i.movie)
  );

  const withAvailability = items.map((item) => ({
    item,
    providerIds: providerIdsByTmdbId.get(item.movie.tmdbId) ?? new Set<number>(),
    owned: ownedTmdbIds.has(item.movie.tmdbId),
    watched: watchedTmdbIds.has(item.movie.tmdbId),
  }));

  const hasServicesConfigured = userProviderIds.size > 0;
  const canFilterByAvailability = hasStreamingAvailability(userProviderIds, ownedTmdbIds);
  const isOnAnyService = ({ providerIds, owned }: { providerIds: Set<number>; owned: boolean }) =>
    owned || isAvailableOnServiceIds(providerIds, userProviderIds);

  const availMode = parseAvail(availRaw);
  function matchesAvail(entry: { providerIds: Set<number>; owned: boolean }): boolean {
    switch (availMode.kind) {
      case "all":
        return true;
      case "on":
        return isOnAnyService(entry);
      case "off":
        return !isOnAnyService(entry);
      case "owned":
        return entry.owned;
      case "service":
        return entry.providerIds.has(availMode.providerId);
    }
  }

  // Facets are built from the whole watchlist, not the currently-filtered
  // view — the same reason onServicesCount/offServicesCount below use the
  // unfiltered list: picking a genre shouldn't make the director dropdown's
  // options shift under the user.
  const filterableMovies = items.map((i) => toFilterableMovie(i.movie));
  const genreOptions = genreFacets(filterableMovies);
  const directorOptions = directorFacets(filterableMovies);
  const runtimeOptions = runtimeFacets(filterableMovies);
  const certificationOptions = certificationFacets(filterableMovies);

  const visibleEntries = withAvailability.filter(
    (entry) => matchesAvail(entry) && matchesFilters(toFilterableMovie(entry.item.movie), attributeFilters)
  );

  const onServicesCount = withAvailability.filter(isOnAnyService).length;
  const offServicesCount = items.length - onServicesCount;
  const filtersActive = availRaw !== "" || hasActiveFilters(attributeFilters);

  const availabilityOptions: FilterOption[] = [
    { value: "", label: "All movies", href: buildHref(current, { avail: "" }) },
  ];
  if (canFilterByAvailability) {
    availabilityOptions.push(
      { value: "on", label: "On my services", href: buildHref(current, { avail: "on" }) },
      { value: "off", label: "Not on my services", href: buildHref(current, { avail: "off" }) }
    );
  }
  if (ownedTmdbIds.size > 0) {
    availabilityOptions.push({ value: "owned", label: "Owned", href: buildHref(current, { avail: "owned" }) });
  }
  for (const service of [...userServices].sort((a, b) => a.providerName.localeCompare(b.providerName))) {
    const value = `svc:${service.providerId}`;
    availabilityOptions.push({
      value,
      label: `Only on ${service.providerName}`,
      href: buildHref(current, { avail: value }),
    });
  }

  const genreSelectOptions: FilterOption[] = [
    { value: "", label: "All genres", href: buildHref(current, { genre: null }) },
    ...genreOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: buildHref(current, { genre: f.value }),
    })),
  ];
  const directorSelectOptions: FilterOption[] = [
    { value: "", label: "All directors", href: buildHref(current, { directorId: null }) },
    ...directorOptions.map((f) => ({
      value: String(f.value),
      label: `${f.label} (${f.count})`,
      href: buildHref(current, { directorId: f.value }),
    })),
  ];
  const runtimeSelectOptions: FilterOption[] = [
    { value: "", label: "Any length", href: buildHref(current, { runtimeBucket: null }) },
    ...runtimeOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: buildHref(current, { runtimeBucket: f.value }),
    })),
  ];
  const certificationSelectOptions: FilterOption[] = [
    { value: "", label: "Any rating", href: buildHref(current, { certification: null }) },
    ...certificationOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: buildHref(current, { certification: f.value }),
    })),
  ];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-4">
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
        <p className="mb-4 text-sm text-muted">
          {items.length} movie{items.length === 1 ? "" : "s"}
          {canFilterByAvailability && (
            <>
              {" "}· {onServicesCount} on your services · {offServicesCount} off
            </>
          )}
          {filtersActive && visibleEntries.length !== items.length && (
            <> · {visibleEntries.length} match your filters</>
          )}
        </p>
      )}

      {items.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          {availabilityOptions.length > 1 ? (
            <FilterSelect label="Streaming" value={availRaw} options={availabilityOptions} />
          ) : (
            <span className="text-xs text-muted">
              You haven&apos;t added any services or marked anything as owned yet —{" "}
              <Link href="/streaming" className="text-accent-green hover:underline">
                add your services here
              </Link>
              .
            </span>
          )}
          {genreOptions.length > 0 && (
            <FilterSelect label="Genre" value={current.genre ?? ""} options={genreSelectOptions} />
          )}
          {directorOptions.length > 0 && (
            <FilterSelect
              label="Director"
              value={current.directorId != null ? String(current.directorId) : ""}
              options={directorSelectOptions}
            />
          )}
          {runtimeOptions.length > 0 && (
            <FilterSelect label="Length" value={current.runtimeBucket ?? ""} options={runtimeSelectOptions} />
          )}
          {certificationOptions.length > 0 && (
            <FilterSelect
              label="Rating"
              value={current.certification ?? ""}
              options={certificationSelectOptions}
            />
          )}
          {filtersActive && (
            <Link
              href={buildHref(current, {
                avail: "",
                genre: null,
                directorId: null,
                runtimeBucket: null,
                certification: null,
              })}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
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
            hrefFor={(key, nextDir) => buildHref(current, { sortKey: key, sortDir: nextDir })}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted">
          Nothing here yet. Find a movie and click &ldquo;+ Watchlist&rdquo; to add it.
        </p>
      ) : visibleEntries.length === 0 ? (
        <p className="text-sm text-muted">
          No movies match your filters.{" "}
          <Link
            href={buildHref(current, {
              avail: "",
              genre: null,
              directorId: null,
              runtimeBucket: null,
              certification: null,
            })}
            className="text-accent-green hover:underline"
          >
            Clear filters
          </Link>
        </p>
      ) : (
        <WatchlistGrid entries={visibleEntries} />
      )}
    </div>
  );
}
