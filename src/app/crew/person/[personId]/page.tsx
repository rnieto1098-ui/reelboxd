import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPersonDetails,
  getPersonMovieCredits,
  profileUrl,
  type TmdbCastCredit,
  type TmdbCrewCredit,
} from "@/lib/tmdb";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { MovieCard } from "@/components/MovieCard";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";

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

const MAX_PER_SECTION = 24;

export default async function PersonPage({
  params,
}: PageProps<"/crew/person/[personId]">) {
  const { personId: personIdParam } = await params;
  const personId = Number(personIdParam);
  if (!Number.isFinite(personId)) notFound();

  const [details, credits] = await Promise.all([
    getPersonDetails(personId).catch(() => null),
    getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] })),
  ]);

  if (!details) notFound();

  const photo = profileUrl(details.profile_path, "w185");

  const actingCredits = dedupeById(credits.cast).sort(byPopularity);

  const crewByDepartment = new Map<string, TmdbCrewCredit[]>();
  for (const credit of credits.crew) {
    const list = crewByDepartment.get(credit.department) ?? [];
    list.push(credit);
    crewByDepartment.set(credit.department, list);
  }
  for (const [dept, list] of crewByDepartment) {
    crewByDepartment.set(dept, dedupeById(list).sort(byPopularity));
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

  const session = await auth();
  const userId = session?.user?.id;

  const [ratingMap, ownedIds, watchlistIds] = await Promise.all([
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
  ]);

  const watchedPercent =
    userId && allCreditIds.size > 0
      ? Math.round((ratingMap.size / allCreditIds.size) * 100)
      : null;

  // Order departments so a person's primary job leads and Acting only comes
  // first when that IS their primary job — a director shouldn't have their
  // (often minor) acting cameos outrank their actual filmography.
  const actingSection = actingCredits.length > 0 ? { key: "Acting", credits: actingCredits } : null;
  const departmentSections = orderedDepartments.map((department) => ({
    key: department,
    credits: crewByDepartment.get(department) ?? [],
  }));
  const primaryDepartment = details.known_for_department;
  const primaryIsCrew =
    !!primaryDepartment && primaryDepartment !== "Acting" && crewByDepartment.has(primaryDepartment);

  const orderedSections = primaryIsCrew && actingSection
    ? [
        ...departmentSections.filter((s) => s.key === primaryDepartment),
        actingSection,
        ...departmentSections.filter((s) => s.key !== primaryDepartment),
      ]
    : [...(actingSection ? [actingSection] : []), ...departmentSections];

  const sections = (
    <div className="space-y-10">
      {orderedSections.map((section) => (
        <CreditSection
          key={section.key}
          title={section.key}
          credits={section.credits}
          ratingMap={ratingMap}
          ownedIds={ownedIds}
          watchlistIds={watchlistIds}
        />
      ))}
    </div>
  );

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
                {watchedPercent}% watched ({ratingMap.size}/{allCreditIds.size})
              </span>
            </div>
          )}
        </div>
      </div>

      {actingCredits.length === 0 && orderedDepartments.length === 0 ? (
        <p className="text-muted">No movie credits found.</p>
      ) : userId ? (
        <FadeWatchedControl>{sections}</FadeWatchedControl>
      ) : (
        sections
      )}
    </div>
  );
}

function CreditSection({
  title,
  credits,
  ratingMap,
  ownedIds,
  watchlistIds,
}: {
  title: string;
  credits: (TmdbCastCredit | TmdbCrewCredit)[];
  ratingMap: Map<number, number>;
  ownedIds: Set<number>;
  watchlistIds: Set<number>;
}) {
  const shown = credits.slice(0, MAX_PER_SECTION);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted">({credits.length})</span>
      </h2>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {shown.map((credit) => (
          <div key={credit.id} data-watched={ratingMap.has(credit.id)}>
            <MovieCard
              tmdbId={credit.id}
              title={credit.title}
              posterPath={credit.poster_path}
              year={credit.release_date?.slice(0, 4)}
              owned={ownedIds.has(credit.id)}
              inWatchlist={watchlistIds.has(credit.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Map<number, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

function byPopularity(a: { popularity?: number }, b: { popularity?: number }) {
  return (b.popularity ?? 0) - (a.popularity ?? 0);
}
