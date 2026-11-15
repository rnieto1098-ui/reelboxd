import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureMovieCached, parseGenres } from "@/lib/movies";
import {
  GAME_KEY,
  MAX_GUESSES,
  computeStats,
  puzzleIndex,
  puzzleNumber,
  type GameFilm,
  type GameStats,
} from "@/lib/dailyGame";

// The films a daily puzzle can be. Two curated lists of widely seen films,
// so the answer is always something a film fan has a fair chance at.
const POOL_LIST_KEYS = ["imdb-top-250", "top-250-most-fans"];

// The pool only changes when a curated list does, so it is kept in memory
// for a while rather than queried on every guess.
const POOL_TTL_MS = 10 * 60 * 1000;
let poolCache: { ids: number[]; expiresAt: number } | null = null;

/** Every candidate film's TMDB id, de-duplicated, in a stable order. */
export async function getPool(): Promise<number[]> {
  if (poolCache && poolCache.expiresAt > Date.now()) return poolCache.ids;
  const items = await prisma.listItem.findMany({
    where: { list: { isSystem: true, key: { in: POOL_LIST_KEYS } } },
    select: { tmdbId: true },
  });
  // Sorted so the order doesn't depend on how the database happens to
  // return rows: the same pool always maps a puzzle number to the same film.
  const ids = [...new Set(items.map((i) => i.tmdbId))].sort((a, b) => a - b);
  // An empty pool (a fresh database whose lists aren't seeded yet) is not
  // cached, so the game starts working as soon as the lists exist.
  if (ids.length > 0) poolCache = { ids, expiresAt: Date.now() + POOL_TTL_MS };
  return ids;
}

type CachedMovie = Awaited<ReturnType<typeof ensureMovieCached>>;

export function toGameFilm(movie: CachedMovie): GameFilm {
  const year = movie.releaseDate ? Number(movie.releaseDate.slice(0, 4)) : NaN;
  return {
    tmdbId: movie.tmdbId,
    title: movie.title,
    year: Number.isInteger(year) ? year : null,
    runtime: movie.runtime && movie.runtime > 0 ? movie.runtime : null,
    certification: movie.certification || null,
    genres: parseGenres(movie.genres),
    directorName: movie.directorName,
    cast: movie.topCastNames ? movie.topCastNames.split(",").map((n) => n.trim()).filter(Boolean) : [],
  };
}

export type DailyAnswer = { day: string; number: number; film: GameFilm; posterPath: string | null };

/**
 * The mystery film for a day, or null if there is no pool to draw from.
 * Server-side only: nothing that calls this may send `film` to a browser
 * before the game is over.
 */
export async function getAnswer(day: string): Promise<DailyAnswer | null> {
  const pool = await getPool();
  const number = puzzleNumber(day);
  const index = puzzleIndex(number, pool.length);
  if (index < 0) return null;
  const movie = await ensureMovieCached(pool[index]);
  return { day, number, film: toGameFilm(movie), posterPath: movie.posterPath };
}

export async function getResult(userId: string, day: string) {
  return prisma.gameResult.findUnique({
    where: { userId_game_day: { userId, game: GAME_KEY, day } },
    select: { solved: true, attempts: true },
  });
}

/**
 * Stores a finished game. The first result for a day stands: a second
 * attempt (another tab, another device, a replay) leaves it untouched, which
 * the unique constraint on (user, game, day) guarantees even if two
 * requests land together.
 */
export async function recordResult(
  userId: string,
  day: string,
  attempts: number,
  solved: boolean
): Promise<void> {
  try {
    await prisma.gameResult.create({
      data: {
        userId,
        game: GAME_KEY,
        day,
        attempts: Math.max(1, Math.min(MAX_GUESSES, Math.round(attempts))),
        solved,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

export async function getStats(userId: string, today: string): Promise<GameStats> {
  const results = await prisma.gameResult.findMany({
    where: { userId, game: GAME_KEY },
    select: { day: true, solved: true, attempts: true },
  });
  return computeStats(results, today);
}
