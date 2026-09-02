import JSZip from "jszip";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { searchMovies } from "@/lib/tmdb";
import { ensureMovieCached } from "@/lib/movies";
import { createDiaryEntry } from "@/lib/diary";
import { checkNewlyCompletedChallenges, type ChallengeCompletion } from "@/lib/challenges";
import { checkGoalJustCompleted } from "@/lib/goals";
import type { Movie } from "@prisma/client";

type CsvRow = Record<string, string>;
type FilmKey = string;

const MATCH_CONCURRENCY = 5;

function filmKey(name: string, year: string) {
  return `${name.trim().toLowerCase()}|${year.trim()}`;
}

async function readCsv(zip: JSZip, filename: string): Promise<CsvRow[] | null> {
  const entry = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith(filename)
  );
  if (!entry) return null;

  const text = await entry.async("string");
  const { data } = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
  return data;
}

async function matchTmdbId(name: string, year: string): Promise<number | null> {
  try {
    const { results } = await searchMovies(name);
    if (results.length === 0) return null;
    if (year) {
      const exact = results.find((m) => m.release_date?.startsWith(year));
      if (exact) return exact.id;
    }
    return results[0].id;
  } catch {
    return null;
  }
}

export type ImportSummary = {
  ratingsImported: number;
  watchlistImported: number;
  diaryImported: number;
  unmatched: { title: string; year: string }[];
  completedChallenges: ChallengeCompletion[];
  completedGoal: { year: number; target: number } | null;
};

type DiaryRow = { key: FilmKey; watchedDate: string; rewatch: boolean };

// Letterboxd's diary.csv uses "Watched Date" for the actual date watched and
// "Date" for the date the entry was logged — usually the same day, but not
// always (logging a watch after the fact). Prefer "Watched Date"; "Date" is
// only there for older exports that predate that column.
function parseDiaryRows(rows: CsvRow[]): DiaryRow[] {
  const parsed: DiaryRow[] = [];
  for (const row of rows) {
    const name = row["Name"];
    const watchedDate = row["Watched Date"] || row["Date"];
    if (!name || !watchedDate) continue;
    parsed.push({
      key: filmKey(name, row["Year"] ?? ""),
      watchedDate,
      rewatch: (row["Rewatch"] ?? "").trim().toLowerCase() === "yes",
    });
  }
  return parsed;
}

export async function importLetterboxdZip(
  userId: string,
  fileBuffer: ArrayBuffer
): Promise<ImportSummary> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const diaryCsv = (await readCsv(zip, "diary.csv")) ?? [];
  const ratingsCsv = (await readCsv(zip, "ratings.csv")) ?? diaryCsv;
  const watchlistCsv = (await readCsv(zip, "watchlist.csv")) ?? [];

  if (ratingsCsv.length === 0 && watchlistCsv.length === 0 && diaryCsv.length === 0) {
    throw new Error(
      "That file didn't contain any of the files we look for (ratings.csv, diary.csv, watchlist.csv). Make sure you uploaded the .zip Letterboxd gave you, unmodified."
    );
  }

  const ratingsByKey = new Map<FilmKey, number>();
  for (const row of ratingsCsv) {
    const name = row["Name"];
    const ratingStr = row["Rating"];
    if (!name || !ratingStr) continue;
    const score = Number(ratingStr);
    if (!Number.isFinite(score) || score <= 0) continue;
    ratingsByKey.set(filmKey(name, row["Year"] ?? ""), score);
  }

  const watchlistKeys = new Set<FilmKey>();
  const diaryRows = parseDiaryRows(diaryCsv);
  const filmsToMatch = new Map<FilmKey, { name: string; year: string }>();

  for (const row of ratingsCsv) {
    if (row["Name"]) {
      filmsToMatch.set(filmKey(row["Name"], row["Year"] ?? ""), {
        name: row["Name"],
        year: row["Year"] ?? "",
      });
    }
  }
  for (const row of watchlistCsv) {
    if (!row["Name"]) continue;
    const k = filmKey(row["Name"], row["Year"] ?? "");
    watchlistKeys.add(k);
    filmsToMatch.set(k, { name: row["Name"], year: row["Year"] ?? "" });
  }
  for (const row of diaryCsv) {
    if (!row["Name"]) continue;
    filmsToMatch.set(filmKey(row["Name"], row["Year"] ?? ""), {
      name: row["Name"],
      year: row["Year"] ?? "",
    });
  }

  const unmatched: { title: string; year: string }[] = [];
  const movieByKey = new Map<FilmKey, Movie>();
  let ratingsImported = 0;
  let watchlistImported = 0;

  const entries = [...filmsToMatch.entries()];

  for (let i = 0; i < entries.length; i += MATCH_CONCURRENCY) {
    const batch = entries.slice(i, i + MATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async ([key, film]) => {
        const tmdbId = await matchTmdbId(film.name, film.year);
        if (!tmdbId) {
          unmatched.push({ title: film.name, year: film.year });
          return;
        }

        const movie = await ensureMovieCached(tmdbId);
        movieByKey.set(key, movie);

        const rating = ratingsByKey.get(key);
        if (rating != null) {
          await prisma.rating.upsert({
            where: { userId_movieId: { userId, movieId: movie.id } },
            update: { score: rating },
            create: { userId, movieId: movie.id, score: rating },
          });
          ratingsImported++;
        }

        if (watchlistKeys.has(key)) {
          await prisma.watchlistItem.upsert({
            where: { userId_movieId: { userId, movieId: movie.id } },
            update: {},
            create: { userId, movieId: movie.id },
          });
          watchlistImported++;
        }
      })
    );
  }

  // Diary rows are processed separately (rather than folded into the
  // per-film loop above) because rewatches mean the same film can appear
  // many times with different watched dates — each one is its own log, not
  // a dedup target like ratings/watchlist are.
  let diaryImported = 0;
  const completedChallenges: ChallengeCompletion[] = [];
  const seenChallengeIds = new Set<string>();
  let completedGoal: { year: number; target: number } | null = null;

  for (let i = 0; i < diaryRows.length; i += MATCH_CONCURRENCY) {
    const batch = diaryRows.slice(i, i + MATCH_CONCURRENCY);
    for (const row of batch) {
      const movie = movieByKey.get(row.key);
      if (!movie) continue;

      const watchedDate = new Date(`${row.watchedDate}T00:00:00.000Z`);
      const dayStart = new Date(watchedDate);
      const dayEnd = new Date(watchedDate.getTime() + 24 * 60 * 60 * 1000);

      const existing = await prisma.diaryEntry.findFirst({
        where: { userId, movieId: movie.id, watchedDate: { gte: dayStart, lt: dayEnd } },
        select: { id: true },
      });
      if (existing) continue;

      await createDiaryEntry({ userId, movieId: movie.id, watchedDate, rewatch: row.rewatch });
      diaryImported++;

      const [newlyCompleted, justCompletedGoal] = await Promise.all([
        row.rewatch ? Promise.resolve([]) : checkNewlyCompletedChallenges(userId, movie, watchedDate),
        checkGoalJustCompleted(userId, watchedDate),
      ]);
      for (const c of newlyCompleted) {
        if (seenChallengeIds.has(c.id)) continue;
        seenChallengeIds.add(c.id);
        completedChallenges.push(c);
      }
      if (justCompletedGoal) completedGoal = justCompletedGoal;
    }
  }

  return {
    ratingsImported,
    watchlistImported,
    diaryImported,
    unmatched,
    completedChallenges,
    completedGoal,
  };
}

export type WatchlistImportSummary = {
  imported: number;
  unmatched: { title: string; year: string }[];
};

// Accepts either a full Letterboxd export .zip (pulls just watchlist.csv out
// of it) or a standalone .csv with Name/Year columns — which also covers
// re-importing this app's own watchlist export, since exportData.ts
// deliberately mirrors that column layout.
async function parseWatchlistRows(file: File): Promise<CsvRow[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const rows = await readCsv(zip, "watchlist.csv");
    if (!rows) {
      throw new Error("That .zip didn't contain a watchlist.csv.");
    }
    return rows;
  }

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const { data } = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });
    return data;
  }

  throw new Error("Please upload a .csv or .zip file.");
}

export async function importWatchlistFile(
  userId: string,
  file: File
): Promise<WatchlistImportSummary> {
  const rows = await parseWatchlistRows(file);
  const films = rows
    .filter((row) => row["Name"])
    .map((row) => ({ title: row["Name"], year: row["Year"] ?? "" }));

  if (films.length === 0) {
    throw new Error(
      "No movies found in that file — make sure it has Name and Year columns."
    );
  }

  const unmatched: { title: string; year: string }[] = [];
  let imported = 0;

  for (let i = 0; i < films.length; i += MATCH_CONCURRENCY) {
    const batch = films.slice(i, i + MATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (film) => {
        const tmdbId = await matchTmdbId(film.title, film.year);
        if (!tmdbId) {
          unmatched.push(film);
          return;
        }

        const movie = await ensureMovieCached(tmdbId);
        await prisma.watchlistItem.upsert({
          where: { userId_movieId: { userId, movieId: movie.id } },
          update: {},
          create: { userId, movieId: movie.id },
        });
        imported++;
      })
    );
  }

  return { imported, unmatched };
}
