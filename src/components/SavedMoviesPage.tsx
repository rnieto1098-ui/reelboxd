import Link from "next/link";
import type { ReactNode } from "react";
import type { CustomPoster, Movie, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getFlatrateProviderIdsByTmdbId,
  getUserOwnedTmdbIds,
  hasStreamingAvailability,
  isAvailableOnServiceIds,
} from "@/lib/streaming";
import { getUserWatchlistedTmdbIds, parseGenres } from "@/lib/movies";
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
import { FilterSelect, type FilterOption } from "@/components/FilterSelect";
import { SortChips } from "@/components/SortChips";
import type { SortDir } from "@/lib/sortComparator";

// The shared body of the watchlist and rewatch-list pages: same filters,
// facets, sorting and streaming availability, just backed by a different
// table. Each page supplies its own loader, title and header links.

export type SavedMovieItem = {
  id: string;
  addedAt: Date;
  movie: Movie & { customPosters: CustomPoster[] };
};

// Both item tables order the same way (addedAt, or a field on the movie), so
// one set of sort options serves both.
export type SavedMovieOrderBy = Prisma.WatchlistItemOrderByWithRelationInput &
  Prisma.RewatchItemOrderByWithRelationInput;

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
} satisfies Record<string, { label: string; orderBy: (dir: Prisma.SortOrder) => SavedMovieOrderBy }>;

type SortKey = keyof typeof SORT_OPTIONS;

// The "streaming" dropdown's value: "" (all), "on"/"off" (aggregate across
// every configured service), "owned", or "svc:<providerId>" for one specific
// service. Kept as one plain string since it only ever needs to round-trip
// through a URL and a <select>'s value.
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

function buildHref(basePath: string, current: CurrentState, overrides: Partial<CurrentState>): string {
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
  return `${basePath}${qs ? `?${qs}` : ""}`;
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

export async function SavedMoviesPage({
  userId,
  searchParams,
  basePath,
  title,
  emptyMessage,
  headerActions,
  loadItems,
  allInWatchlist,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
  title: string;
  emptyMessage: ReactNode;
  headerActions?: (itemCount: number) => ReactNode;
  loadItems: (orderBy: SavedMovieOrderBy) => Promise<SavedMovieItem[]>;
  // True for the watchlist itself; anywhere else, each card's bookmark
  // reflects whether that film is actually on the watchlist.
  allInWatchlist: boolean;
}) {
  const { sort, dir, avail, genre, director, runtime, cert } = searchParams;
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
  const href = (overrides: Partial<CurrentState>) => buildHref(basePath, current, overrides);
  const attributeFilters: WatchlistFilters = {
    genre: current.genre,
    directorId: current.directorId,
    runtimeBucket: current.runtimeBucket,
    certification: current.certification,
  };

  const [items, userServices, ownedTmdbIds, watchedTmdbIds, watchlistTmdbIds] = await Promise.all([
    loadItems(SORT_OPTIONS[sortKey].orderBy(sortDir)),
    prisma.streamingService.findMany({
      where: { userId },
      select: { providerId: true, providerName: true },
    }),
    getUserOwnedTmdbIds(userId),
    // Usually empty on the watchlist (logging, rating, or marking a film
    // watched drops it), usually full on the rewatch list — either way it
    // can't just be assumed.
    getWatchedTmdbIds(userId),
    allInWatchlist ? Promise.resolve(null) : getUserWatchlistedTmdbIds(userId),
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
    inWatchlist: watchlistTmdbIds ? watchlistTmdbIds.has(item.movie.tmdbId) : true,
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

  // Facets are built from the whole list, not the currently-filtered view —
  // the same reason onServicesCount/offServicesCount below use the unfiltered
  // list: picking a genre shouldn't make the director dropdown's options
  // shift under the user.
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
  const clearFiltersHref = href({
    avail: "",
    genre: null,
    directorId: null,
    runtimeBucket: null,
    certification: null,
  });

  const availabilityOptions: FilterOption[] = [{ value: "", label: "All movies", href: href({ avail: "" }) }];
  if (canFilterByAvailability) {
    availabilityOptions.push(
      { value: "on", label: "On my services", href: href({ avail: "on" }) },
      { value: "off", label: "Not on my services", href: href({ avail: "off" }) }
    );
  }
  if (ownedTmdbIds.size > 0) {
    availabilityOptions.push({ value: "owned", label: "Owned", href: href({ avail: "owned" }) });
  }
  for (const service of [...userServices].sort((a, b) => a.providerName.localeCompare(b.providerName))) {
    const value = `svc:${service.providerId}`;
    availabilityOptions.push({ value, label: `Only on ${service.providerName}`, href: href({ avail: value }) });
  }

  const genreSelectOptions: FilterOption[] = [
    { value: "", label: "All genres", href: href({ genre: null }) },
    ...genreOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: href({ genre: f.value }),
    })),
  ];
  const directorSelectOptions: FilterOption[] = [
    { value: "", label: "All directors", href: href({ directorId: null }) },
    ...directorOptions.map((f) => ({
      value: String(f.value),
      label: `${f.label} (${f.count})`,
      href: href({ directorId: f.value }),
    })),
  ];
  const runtimeSelectOptions: FilterOption[] = [
    { value: "", label: "Any length", href: href({ runtimeBucket: null }) },
    ...runtimeOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: href({ runtimeBucket: f.value }),
    })),
  ];
  const certificationSelectOptions: FilterOption[] = [
    { value: "", label: "Any rating", href: href({ certification: null }) },
    ...certificationOptions.map((f) => ({
      value: f.value,
      label: `${f.label} (${f.count})`,
      href: href({ certification: f.value }),
    })),
  ];

  return (
    <div>
      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {headerActions?.(items.length)}
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
            <Link href={clearFiltersHref} className="text-xs text-muted hover:text-foreground hover:underline">
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
            hrefFor={(key, nextDir) => href({ sortKey: key, sortDir: nextDir })}
          />
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-muted">{emptyMessage}</p>
      ) : visibleEntries.length === 0 ? (
        <p className="text-sm text-muted">
          No movies match your filters.{" "}
          <Link href={clearFiltersHref} className="text-accent-green hover:underline">
            Clear filters
          </Link>
        </p>
      ) : (
        <WatchlistGrid entries={visibleEntries} />
      )}
    </div>
  );
}
