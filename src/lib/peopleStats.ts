import { prisma } from "@/lib/prisma";
import { backfillMovieCredits, type MovieCreditFields } from "@/lib/movies";

const TOP_N = 5;
// "Highest rated" needs more than one data point to mean anything — a
// single 5-star film would otherwise always win. Chosen to match the
// analogous MIN_FILMS-style thresholds used elsewhere in this app's stats.
const MIN_FILMS_FOR_RATING = 2;
// Caps how many never-backfilled movies get a live TMDB refetch per stats
// page load — a large, long-running library could otherwise mean hundreds
// of sequential-ish fetches on the first load after this feature shipped.
// Whatever's left over gets picked up on a later load instead (self-heals
// gradually rather than trying to do it all in one request).
const BACKFILL_CAP = 60;
const BACKFILL_CONCURRENCY = 5;

const MOVIE_CREDIT_SELECT = {
  id: true,
  tmdbId: true,
  directorId: true,
  directorName: true,
  topCastIds: true,
  topCastNames: true,
  cinematographerId: true,
  cinematographerName: true,
} as const;

export type PersonCount = { id: number; name: string; count: number };
export type PersonRating = { id: number; name: string; avgRating: number; filmCount: number };
export type PeopleCategory = { mostWatched: PersonCount[]; highestRated: PersonRating[] };
export type TopPeopleStats = {
  directors: PeopleCategory;
  actors: PeopleCategory;
  cinematographers: PeopleCategory;
};

function addCount(map: Map<number, PersonCount>, id: number | null, name: string | null) {
  if (id == null || !name) return;
  const existing = map.get(id);
  if (existing) existing.count++;
  else map.set(id, { id, name, count: 1 });
}

function topByCount(map: Map<number, PersonCount>): PersonCount[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, TOP_N);
}

function addRating(
  map: Map<number, { id: number; name: string; total: number; count: number }>,
  id: number | null,
  name: string | null,
  score: number
) {
  if (id == null || !name) return;
  const existing = map.get(id);
  if (existing) {
    existing.total += score;
    existing.count++;
  } else {
    map.set(id, { id, name, total: score, count: 1 });
  }
}

function topByRating(
  map: Map<number, { id: number; name: string; total: number; count: number }>
): PersonRating[] {
  return [...map.values()]
    .filter((p) => p.count >= MIN_FILMS_FOR_RATING)
    .map((p) => ({ id: p.id, name: p.name, avgRating: p.total / p.count, filmCount: p.count }))
    .sort((a, b) => b.avgRating - a.avgRating || b.filmCount - a.filmCount)
    .slice(0, TOP_N);
}

function topCastPairs(movie: MovieCreditFields): { id: number; name: string }[] {
  const ids = movie.topCastIds?.split(",").map(Number) ?? [];
  const names = movie.topCastNames?.split(",") ?? [];
  return ids.map((id, i) => ({ id, name: names[i] })).filter((p) => p.name);
}

export async function getTopPeopleStats(userId: string): Promise<TopPeopleStats> {
  const [ratings, diaryEntries] = await Promise.all([
    prisma.rating.findMany({
      where: { userId },
      select: { score: true, movie: { select: MOVIE_CREDIT_SELECT } },
    }),
    prisma.diaryEntry.findMany({
      where: { userId },
      select: { movie: { select: MOVIE_CREDIT_SELECT } },
    }),
  ]);

  // Backfill rows cached before credit names were tracked so long-time
  // users' history isn't missing people just because they rated/logged
  // those films before this feature existed.
  const byMovieId = new Map<string, MovieCreditFields>();
  for (const r of ratings) byMovieId.set(r.movie.id, r.movie);
  for (const e of diaryEntries) byMovieId.set(e.movie.id, e.movie);

  const needsBackfill = [...byMovieId.values()]
    .filter((m) => m.topCastIds != null && m.topCastNames == null)
    .slice(0, BACKFILL_CAP);
  for (let i = 0; i < needsBackfill.length; i += BACKFILL_CONCURRENCY) {
    const batch = needsBackfill.slice(i, i + BACKFILL_CONCURRENCY);
    const updated = await Promise.all(batch.map((m) => backfillMovieCredits(m)));
    for (const m of updated) byMovieId.set(m.id, m);
  }

  const directorWatched = new Map<number, PersonCount>();
  const actorWatched = new Map<number, PersonCount>();
  const cinematographerWatched = new Map<number, PersonCount>();

  // "Most watched" counts every log, rewatches included — it's asking how
  // many times you've watched something from this person, not how many
  // distinct films.
  for (const entry of diaryEntries) {
    const movie = byMovieId.get(entry.movie.id) ?? entry.movie;
    addCount(directorWatched, movie.directorId, movie.directorName);
    addCount(cinematographerWatched, movie.cinematographerId, movie.cinematographerName);
    for (const actor of topCastPairs(movie)) addCount(actorWatched, actor.id, actor.name);
  }

  const directorRatings = new Map<number, { id: number; name: string; total: number; count: number }>();
  const actorRatings = new Map<number, { id: number; name: string; total: number; count: number }>();
  const cinematographerRatings = new Map<
    number,
    { id: number; name: string; total: number; count: number }
  >();

  for (const r of ratings) {
    const movie = byMovieId.get(r.movie.id) ?? r.movie;
    addRating(directorRatings, movie.directorId, movie.directorName, r.score);
    addRating(cinematographerRatings, movie.cinematographerId, movie.cinematographerName, r.score);
    for (const actor of topCastPairs(movie)) addRating(actorRatings, actor.id, actor.name, r.score);
  }

  return {
    directors: { mostWatched: topByCount(directorWatched), highestRated: topByRating(directorRatings) },
    actors: { mostWatched: topByCount(actorWatched), highestRated: topByRating(actorRatings) },
    cinematographers: {
      mostWatched: topByCount(cinematographerWatched),
      highestRated: topByRating(cinematographerRatings),
    },
  };
}
