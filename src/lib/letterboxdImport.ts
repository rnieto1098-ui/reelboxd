import JSZip from "jszip";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { searchMovies } from "@/lib/tmdb";
import { ensureMovieCached } from "@/lib/movies";

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
  unmatched: { title: string; year: string }[];
};

export async function importLetterboxdZip(
  userId: string,
  fileBuffer: ArrayBuffer
): Promise<ImportSummary> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const ratingsCsv =
    (await readCsv(zip, "ratings.csv")) ?? (await readCsv(zip, "diary.csv")) ?? [];
  const watchlistCsv = (await readCsv(zip, "watchlist.csv")) ?? [];

  if (ratingsCsv.length === 0 && watchlistCsv.length === 0) {
    throw new Error(
      "That file didn't contain any of the files we look for (ratings.csv, watchlist.csv). Make sure you uploaded the .zip Letterboxd gave you, unmodified."
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

  const unmatched: { title: string; year: string }[] = [];
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

  return { ratingsImported, watchlistImported, unmatched };
}
