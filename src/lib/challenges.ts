import { prisma } from "@/lib/prisma";
import { parseGenres } from "@/lib/movies";
import {
  discoverMovies,
  getGenres,
  getPersonMovieCredits,
  type TmdbCastCredit,
  type TmdbCrewCredit,
  type TmdbMovieSummary,
} from "@/lib/tmdb";

// Custom user-built challenges (genre quota, date-range quota, or a "watch
// this person's whole filmography" completionist goal). The built-in yearly
// challenge is a separate model (WatchGoal, see lib/goals.ts) since it's the
// one shown on the homepage — these are Challenges-tab-only.
export type ChallengeType = "GENRE" | "TIMEFRAME" | "CREW";

export type ChallengeSummary = {
  id: string;
  type: ChallengeType;
  title: string;
  target: number | null;
  count: number;
  percent: number | null;
  genreName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  personId: number | null;
  personName: string | null;
  department: string | null;
};

function percentOf(count: number, target: number | null): number | null {
  return target != null && target > 0 ? Math.min(100, Math.round((count / target) * 100)) : null;
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Map<number, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

// A person's filmography for a given department — null department means
// their acting credits, matching the convention used on the crew person page.
export async function getCrewFilmography(
  personId: number,
  department: string | null
): Promise<(TmdbCastCredit | TmdbCrewCredit)[]> {
  const credits = await getPersonMovieCredits(personId).catch(() => ({ cast: [], crew: [] }));
  return department
    ? dedupeById(credits.crew.filter((c) => c.department === department))
    : dedupeById(credits.cast);
}

async function genreCount(userId: string, genreName: string): Promise<number> {
  const rows = await prisma.diaryEntry.findMany({
    where: { userId, movie: { genres: { contains: genreName } } },
    select: { movieId: true },
    distinct: ["movieId"],
  });
  return rows.length;
}

async function timeframeCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
  const rows = await prisma.diaryEntry.findMany({
    where: { userId, watchedDate: { gte: startDate, lte: endDate } },
    select: { movieId: true },
    distinct: ["movieId"],
  });
  return rows.length;
}

// How many distinct movies the user has already logged in each genre — for
// the "you've already logged N of these" live preview on the new-challenge
// form, computed once up front rather than per-keystroke. Movie.genres is a
// single comma-joined string rather than a real relation, so this counts by
// tallying in JS rather than a SQL group-by.
export async function getGenreCounts(userId: string): Promise<Record<string, number>> {
  const entries = await prisma.diaryEntry.findMany({
    where: { userId },
    select: { movie: { select: { genres: true } } },
    distinct: ["movieId"],
  });

  const counts: Record<string, number> = {};
  for (const entry of entries) {
    for (const genre of parseGenres(entry.movie.genres)) {
      counts[genre] = (counts[genre] ?? 0) + 1;
    }
  }
  return counts;
}

// Same idea for a TIMEFRAME challenge, computed on demand since it depends
// on both dates the user picked.
export async function getTimeframePreviewCount(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  return timeframeCount(userId, startDate, endDate);
}

async function crewProgress(
  userId: string,
  personId: number,
  department: string | null
): Promise<{ count: number; target: number }> {
  const filmography = await getCrewFilmography(personId, department);
  if (filmography.length === 0) return { count: 0, target: 0 };

  const logged = await prisma.diaryEntry.findMany({
    where: { userId, movie: { tmdbId: { in: filmography.map((c) => c.id) } } },
    select: { movie: { select: { tmdbId: true } } },
    distinct: ["movieId"],
  });
  return { count: new Set(logged.map((l) => l.movie.tmdbId)).size, target: filmography.length };
}

export type ChallengeCompletion = { id: string; title: string };

// Called right after a diary entry is created, to say which of the user's
// challenges just crossed 100% because of it — so the logging UI can
// celebrate the moment instead of the user only noticing next time they
// visit the Challenges tab. Only fires off a first-ever watch of a movie
// (a rewatch can't newly satisfy a challenge, since progress is counted by
// distinct movie, not by log) and only for challenges the movie actually
// matches, which lets it use a cheap "count now equals target" check rather
// than separately computing before/after counts.
export async function checkNewlyCompletedChallenges(
  userId: string,
  movie: { tmdbId: number; genres: string | null },
  watchedDate: Date
): Promise<ChallengeCompletion[]> {
  const challenges = await prisma.challenge.findMany({ where: { userId } });
  if (challenges.length === 0) return [];

  const completions: ChallengeCompletion[] = [];

  for (const c of challenges) {
    if (c.type === "GENRE" && c.genreName && c.target) {
      if (!movie.genres?.includes(c.genreName)) continue;
      const count = await genreCount(userId, c.genreName);
      if (count === c.target) completions.push({ id: c.id, title: c.title });
    } else if (c.type === "TIMEFRAME" && c.startDate && c.endDate && c.target) {
      if (watchedDate < c.startDate || watchedDate > c.endDate) continue;
      const count = await timeframeCount(userId, c.startDate, c.endDate);
      if (count === c.target) completions.push({ id: c.id, title: c.title });
    } else if (c.type === "CREW" && c.personId != null) {
      const filmography = await getCrewFilmography(c.personId, c.department);
      if (filmography.length === 0 || !filmography.some((f) => f.id === movie.tmdbId)) continue;
      const logged = await prisma.diaryEntry.findMany({
        where: { userId, movie: { tmdbId: { in: filmography.map((f) => f.id) } } },
        select: { movie: { select: { tmdbId: true } } },
        distinct: ["movieId"],
      });
      const count = new Set(logged.map((l) => l.movie.tmdbId)).size;
      if (count === filmography.length) completions.push({ id: c.id, title: c.title });
    }
  }

  return completions;
}

export async function getChallengesWithProgress(userId: string): Promise<ChallengeSummary[]> {
  const challenges = await prisma.challenge.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    challenges.map(async (c): Promise<ChallengeSummary> => {
      let count = 0;
      let target = c.target;

      if (c.type === "GENRE" && c.genreName) {
        count = await genreCount(userId, c.genreName);
      } else if (c.type === "TIMEFRAME" && c.startDate && c.endDate) {
        count = await timeframeCount(userId, c.startDate, c.endDate);
      } else if (c.type === "CREW" && c.personId != null) {
        const progress = await crewProgress(userId, c.personId, c.department);
        count = progress.count;
        target = progress.target;
      }

      return {
        id: c.id,
        type: c.type as ChallengeType,
        title: c.title,
        target,
        count,
        percent: percentOf(count, target),
        genreName: c.genreName,
        startDate: c.startDate,
        endDate: c.endDate,
        personId: c.personId,
        personName: c.personName,
        department: c.department,
      };
    })
  );
}

export async function createChallenge(
  userId: string,
  input:
    | { type: "GENRE"; genreName: string; target: number }
    | { type: "TIMEFRAME"; startDate: Date; endDate: Date; target: number }
    | { type: "CREW"; personId: number; personName: string; department: string | null }
) {
  const title =
    input.type === "GENRE"
      ? `Watch ${input.target} ${input.genreName} movies`
      : input.type === "TIMEFRAME"
        ? `Watch ${input.target} movies (${input.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} – ${input.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })})`
        : `Watch all of ${input.personName}'s ${input.department ? input.department.toLowerCase() : "acting"} movies`;

  return prisma.challenge.create({
    data: {
      userId,
      title,
      type: input.type,
      target: input.type === "CREW" ? null : input.target,
      genreName: input.type === "GENRE" ? input.genreName : null,
      startDate: input.type === "TIMEFRAME" ? input.startDate : null,
      endDate: input.type === "TIMEFRAME" ? input.endDate : null,
      personId: input.type === "CREW" ? input.personId : null,
      personName: input.type === "CREW" ? input.personName : null,
      department: input.type === "CREW" ? input.department : null,
    },
  });
}

export async function deleteChallenge(userId: string, id: string) {
  await prisma.challenge.deleteMany({ where: { id, userId } });
}

const SUGGESTION_COUNT = 12;

// Popular movies that would actually count toward a GENRE or TIMEFRAME
// challenge, filtered down to ones the user hasn't already logged — the
// contributing-movies grid only shows what's already watched, this is what
// to watch next. Not offered for CREW challenges since the filmography grid
// (watched + unwatched) already serves that purpose.
export async function getChallengeSuggestions(
  userId: string,
  challenge: { type: string; genreName: string | null }
): Promise<TmdbMovieSummary[]> {
  if (challenge.type === "CREW") return [];

  const [genresData, logged] = await Promise.all([
    challenge.type === "GENRE" ? getGenres().catch(() => ({ genres: [] })) : null,
    prisma.diaryEntry.findMany({
      where: { userId },
      select: { movie: { select: { tmdbId: true } } },
      distinct: ["movieId"],
    }),
  ]);
  const loggedTmdbIds = new Set(logged.map((l) => l.movie.tmdbId));

  const genreId =
    challenge.type === "GENRE" && challenge.genreName
      ? genresData?.genres.find((g) => g.name === challenge.genreName)?.id
      : undefined;
  if (challenge.type === "GENRE" && genreId == null) return [];

  const { results } = await discoverMovies({
    genreIds: genreId != null ? [genreId] : undefined,
    sortBy: "popularity.desc",
  }).catch(() => ({ results: [] }));

  return results.filter((m) => !loggedTmdbIds.has(m.id)).slice(0, SUGGESTION_COUNT);
}
