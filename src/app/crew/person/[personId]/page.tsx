import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPersonDetails,
  getPersonMovieCredits,
  profileUrl,
  type TmdbCastCredit,
  type TmdbCrewCredit,
  type TmdbPersonDetails,
} from "@/lib/tmdb";
import { ensureMovieCached, getUserWatchlistedTmdbIds } from "@/lib/movies";
import {
  filterMoviesByStreaming,
  getUserOwnedTmdbIds,
  getUserProviderIds,
  hasStreamingAvailability,
} from "@/lib/streaming";
import { compareNullableNumbers, type SortDir } from "@/lib/sortComparator";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";
import { AvailabilityFilterLinks } from "@/components/AvailabilityFilterLinks";
import { CreditGrid, type CreditDisplay } from "@/components/CreditGrid";

const DEPARTMENT_ORDER = [
  "Directing",
  "Writing",
  "Production",
  "Camera",
  "Sound",
  "Editing",
  "Art",
  "Costume & Make-Up",
  "Visual Effects",
  "Crew",
];

type Credit = TmdbCastCredit | TmdbCrewCredit;

const SORT_OPTIONS = {
  popularity: { label: "Popularity" },
  release: { label: "Release Date" },
  rating: { label: "TMDB Rating" },
  yourRating: { label: "Your Rating" },
  runtime: { label: "Runtime" },
} satisfies Record<string, { label: string }>;

type SortKey = keyof typeof SORT_OPTIONS;

function compareCredits(
  a: Credit,
  b: Credit,
  sortKey: SortKey,
  dir: SortDir,
  ratingMap: Map<number, number>,
  runtimeMap: Map<number, number>
): number {
  function valueOf(c: Credit): number | null {
    if (sortKey === "popularity") return c.popularity ?? null;
    if (sortKey === "release") return c.release_date ? new Date(c.release_date).getTime() : null;
    if (sortKey === "rating") return c.vote_average ?? null;
    if (sortKey === "yourRating") return ratingMap.get(c.id) ?? null;
    return runtimeMap.get(c.id) ?? null;
  }
  return compareNullableNumbers(valueOf(a), valueOf(b), dir);
}

// Bumped from 8 — these are simple, cache-first GETs (ensureMovieCached hits
// the local DB before ever touching TMDB), and higher concurrency shortens
// the tail latency for prolific people (100+ credits) the most, which is
// exactly the case that was slow.
const RUNTIME_LOOKUP_CONCURRENCY = 16;

// Runtime isn't in TMDB's person-credits response at all (only the full
// per-movie details endpoint has it, same gap the Recommend Me runtime fix
// hit) — only fetched when the runtime sort is actually selected, via the
// same local-cache helper every rating/watchlist/owned action already warms.
async function getRuntimeMap(tmdbIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (let i = 0; i < tmdbIds.length; i += RUNTIME_LOOKUP_CONCURRENCY) {
    const batch = tmdbIds.slice(i, i + RUNTIME_LOOKUP_CONCURRENCY);
    const movies = await Promise.all(batch.map((id) => ensureMovieCached(id).catch(() => null)));
    batch.forEach((id, idx) => {
      const runtime = movies[idx]?.runtime;
      if (runtime != null) map.set(id, runtime);
    });
  }
  return map;
}

function buildHref(personId: number, sortKey: SortKey, dir: SortDir, streamingOnly: boolean) {
  const params = new URLSearchParams();
  if (sortKey !== "popularity") params.set("sort", sortKey);
  if (dir !== "desc") params.set("dir", dir);
  if (streamingOnly) params.set("streaming", "1");
  const qs = params.toString();
  return `/crew/person/${personId}${qs ? `?${qs}` : ""}`;
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Map<number, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

export default async function PersonPage({
  params,
  searchParams,
}: PageProps<"/crew/person/[personId]">) {
  const { personId: personIdParam } = await params;
  const { streaming, sort, dir } = await searchParams;
  const streamingOnly = streaming === "1";
  const sortKey: SortKey = typeof sort === "string" && sort in SORT_OPTIONS ? (sort as SortKey) : "popularity";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";
  const personId = Number(personIdParam);
  if (!Number.isFinite(personId)) notFound();

  // Only the fast, single-call data needed for the header lives in this
  // top-level await — everything that needs the (potentially much slower,
  // for prolific people with a runtime sort) full credits list is pushed
  // into the Suspense boundary below so the header streams to the browser
  // immediately instead of the whole page waiting on it.
  const details = await getPersonDetails(personId).catch(() => null);
  if (!details) notFound();

  const session = await auth();
  const userId = session?.user?.id;
  const photo = profileUrl(details.profile_path, "w185");

  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-surface sm:h-36 sm:w-36">
          {photo ? (
            <Image
              src={photo}
              alt={details.name}
              width={144}
              height={144}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted">
              {details.name[0]}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{details.name}</h1>
          {details.known_for_department && (
            <p className="text-sm text-muted">{details.known_for_department}</p>
          )}
          {(details.birthday || details.place_of_birth) && (
            <p className="mt-1 text-sm text-muted">
              {details.birthday && `Born ${details.birthday}`}
              {details.birthday && details.place_of_birth && " · "}
              {details.place_of_birth}
            </p>
          )}
          {details.biography && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted line-clamp-6">
              {details.biography}
            </p>
          )}
        </div>
      </div>

      <Suspense
        key={`${personId}-${sortKey}-${sortDir}-${streamingOnly}`}
        fallback={<PersonCreditsSkeleton />}
      >
        <PersonCredits
          personId={personId}
          details={details}
          sortKey={sortKey}
          sortDir={sortDir}
          streamingOnly={streamingOnly}
          userId={userId}
        />
      </Suspense>
    </div>
  );
}

function PersonCreditsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-24 rounded-full bg-surface" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] rounded-md bg-surface" />
        ))}
      </div>
    </div>
  );
}

async function PersonCredits({
  personId,
  details,
  sortKey,
  sortDir,
  streamingOnly,
  userId,
}: {
  personId: number;
  details: TmdbPersonDetails;
  sortKey: SortKey;
  sortDir: SortDir;
  streamingOnly: boolean;
  userId: string | undefined;
}) {
  const credits = await getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] }));

  // Deduped only for now — the actual sort (which needs ratingMap and
  // possibly runtimeMap, fetched further down) is applied once those are
  // available.
  const actingCredits = dedupeById(credits.cast);

  const crewByDepartment = new Map<string, TmdbCrewCredit[]>();
  for (const credit of credits.crew) {
    const list = crewByDepartment.get(credit.department) ?? [];
    list.push(credit);
    crewByDepartment.set(credit.department, list);
  }
  for (const [dept, list] of crewByDepartment) {
    crewByDepartment.set(dept, dedupeById(list));
  }

  const orderedDepartments = [
    ...DEPARTMENT_ORDER.filter((d) => crewByDepartment.has(d)),
    ...[...crewByDepartment.keys()].filter((d) => !DEPARTMENT_ORDER.includes(d)),
  ];

  const allCreditIds = new Set<number>();
  for (const credit of actingCredits) allCreditIds.add(credit.id);
  for (const list of crewByDepartment.values()) {
    for (const credit of list) allCreditIds.add(credit.id);
  }

  // "Watched" should reflect this person's actual craft — an actor's
  // percentage means the movies they acted in, not every movie they ever
  // touched in any capacity (a director's one-off cameo shouldn't count the
  // same as their directing work). TMDB's own known_for_department is the
  // person's primary job; falls back to every credit only if that
  // department is missing or (rare data gap) has no credits here at all.
  const primaryDepartment = details.known_for_department;
  const primaryDeptCredits =
    primaryDepartment === "Acting" ? actingCredits : crewByDepartment.get(primaryDepartment ?? "");
  const primaryCreditIds =
    primaryDeptCredits && primaryDeptCredits.length > 0
      ? new Set(primaryDeptCredits.map((c) => c.id))
      : allCreditIds;

  const [ratingMap, ownedIds, watchlistIds, userProviderIds] = await Promise.all([
    userId && allCreditIds.size > 0
      ? prisma.rating
          .findMany({
            where: { userId, movie: { tmdbId: { in: [...allCreditIds] } } },
            select: { score: true, movie: { select: { tmdbId: true } } },
          })
          .then((rows) => new Map(rows.map((r) => [r.movie.tmdbId, r.score])))
      : Promise.resolve(new Map<number, number>()),
    getUserOwnedTmdbIds(userId),
    getUserWatchlistedTmdbIds(userId),
    getUserProviderIds(userId),
  ]);

  const runtimeMap =
    sortKey === "runtime" && allCreditIds.size > 0
      ? await getRuntimeMap([...allCreditIds])
      : new Map<number, number>();

  const canFilterByAvailability = hasStreamingAvailability(userProviderIds, ownedIds);
  const applyStreamingFilter = streamingOnly && canFilterByAvailability;

  const watchedCount = [...primaryCreditIds].filter((id) => ratingMap.has(id)).length;
  const watchedPercent =
    userId && primaryCreditIds.size > 0 ? Math.round((watchedCount / primaryCreditIds.size) * 100) : null;

  const sortedActingCredits = [...actingCredits].sort((a, b) =>
    compareCredits(a, b, sortKey, sortDir, ratingMap, runtimeMap)
  );
  for (const [dept, list] of crewByDepartment) {
    crewByDepartment.set(
      dept,
      [...list].sort((a, b) => compareCredits(a, b, sortKey, sortDir, ratingMap, runtimeMap))
    );
  }

  // Order departments so a person's primary job leads and Acting only comes
  // first when that IS their primary job — a director shouldn't have their
  // (often minor) acting cameos outrank their actual filmography.
  const actingSection: { key: string; credits: Credit[] } | null =
    sortedActingCredits.length > 0 ? { key: "Acting", credits: sortedActingCredits } : null;
  const departmentSections: { key: string; credits: Credit[] }[] = orderedDepartments.map(
    (department) => ({
      key: department,
      credits: crewByDepartment.get(department) ?? [],
    })
  );
  const primaryIsCrew =
    !!primaryDepartment && primaryDepartment !== "Acting" && crewByDepartment.has(primaryDepartment);

  const orderedSections = primaryIsCrew && actingSection
    ? [
        ...departmentSections.filter((s) => s.key === primaryDepartment),
        actingSection,
        ...departmentSections.filter((s) => s.key !== primaryDepartment),
      ]
    : [...(actingSection ? [actingSection] : []), ...departmentSections];

  // Filtering happens on the full per-department list, before the
  // MAX_PER_SECTION slice inside CreditSection — otherwise a prolific
  // person's section could slice down to 24 credits and then filter most of
  // those away, showing far fewer than what's actually available.
  const filteredSections = applyStreamingFilter
    ? await Promise.all(
        orderedSections.map(async (section) => ({
          ...section,
          credits: await filterMoviesByStreaming(section.credits, userProviderIds, ownedIds),
        }))
      )
    : orderedSections;
  const hasAnyFilteredCredits = filteredSections.some((s) => s.credits.length > 0);

  // Resolved to plain, primitive-only objects here (server-side, where the
  // Maps/Sets live) rather than passed across into the client CreditGrid —
  // same boundary discipline as MovieCard/MovieRow elsewhere in this app.
  const displaySections = filteredSections.map((section) => ({
    key: section.key,
    credits: section.credits.map(
      (credit): CreditDisplay => ({
        id: credit.id,
        title: credit.title,
        posterPath: credit.poster_path,
        year: credit.release_date?.slice(0, 4),
        owned: ownedIds.has(credit.id),
        inWatchlist: watchlistIds.has(credit.id),
        watched: ratingMap.has(credit.id),
      })
    ),
  }));

  const sections = (
    <div className="space-y-10">
      {displaySections.map((section) => (
        <CreditGrid key={section.key} title={section.key} credits={section.credits} />
      ))}
    </div>
  );

  return (
    <>
      {watchedPercent != null && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted">
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
            {watchedPercent}% of {primaryDepartment ?? "their"} credits watched ({watchedCount}/
            {primaryCreditIds.size})
          </span>
        </div>
      )}

      {allCreditIds.size > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-xs">
          <span className="mr-1 text-muted">Sort:</span>
          {(Object.keys(SORT_OPTIONS) as SortKey[])
            .filter((key) => key !== "yourRating" || userId)
            .map((key) => {
              const isActive = sortKey === key;
              // Clicking the already-active sort flips its direction;
              // clicking a different one starts it at the default direction.
              const nextDir: SortDir = isActive ? (sortDir === "desc" ? "asc" : "desc") : "desc";
              return (
                <Link
                  key={key}
                  href={buildHref(personId, key, nextDir, streamingOnly)}
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

      {userId && allCreditIds.size > 0 && (
        <AvailabilityFilterLinks
          className="mb-6"
          allHref={buildHref(personId, sortKey, sortDir, false)}
          streamingHref={buildHref(personId, sortKey, sortDir, true)}
          streamingOnly={streamingOnly}
          canFilterByAvailability={canFilterByAvailability}
        />
      )}

      {actingCredits.length === 0 && orderedDepartments.length === 0 ? (
        <p className="text-muted">No movie credits found.</p>
      ) : applyStreamingFilter && !hasAnyFilteredCredits ? (
        <p className="text-muted">None of this person&apos;s movies are on your streaming services or owned right now.</p>
      ) : userId ? (
        <FadeWatchedControl>{sections}</FadeWatchedControl>
      ) : (
        sections
      )}
    </>
  );
}

