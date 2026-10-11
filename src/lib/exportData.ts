import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

// Mirrors the columns letterboxdImport.ts reads (Name, Year, Rating) — an
// export can be re-imported straight back into Flixtally, and uses the same
// header names Letterboxd's own export uses, so it's a reasonable stand-in
// there too even though full compatibility with Letterboxd's own importer
// isn't guaranteed.

type DatedMovieRow = { addedAt: Date; movie: { title: string; releaseDate: string | null } };

function savedMoviesCsv(rows: DatedMovieRow[]): string {
  return toCsv(
    ["Date", "Name", "Year"],
    rows.map((r) => [
      r.addedAt.toISOString().slice(0, 10),
      r.movie.title,
      r.movie.releaseDate?.slice(0, 4) ?? "",
    ])
  );
}

export async function exportWatchlistCsv(userId: string): Promise<string> {
  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId },
    include: { movie: true },
    orderBy: { addedAt: "asc" },
  });
  return savedMoviesCsv(watchlist);
}

export async function exportRewatchCsv(userId: string): Promise<string> {
  const rewatch = await prisma.rewatchItem.findMany({
    where: { userId },
    include: { movie: true },
    orderBy: { addedAt: "asc" },
  });
  return savedMoviesCsv(rewatch);
}

export async function exportUserDataZip(userId: string): Promise<Buffer> {
  const [ratings, watchlistCsv, rewatchCsv, diaryEntries] = await Promise.all([
    prisma.rating.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { createdAt: "asc" },
    }),
    exportWatchlistCsv(userId),
    exportRewatchCsv(userId),
    prisma.diaryEntry.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { watchedDate: "asc" },
    }),
  ]);

  const zip = new JSZip();

  zip.file(
    "ratings.csv",
    toCsv(
      ["Date", "Name", "Year", "Rating"],
      ratings.map((r) => [
        r.createdAt.toISOString().slice(0, 10),
        r.movie.title,
        r.movie.releaseDate?.slice(0, 4) ?? "",
        String(r.score),
      ])
    )
  );

  zip.file("watchlist.csv", watchlistCsv);
  zip.file("rewatch.csv", rewatchCsv);

  zip.file(
    "diary.csv",
    toCsv(
      ["Watched Date", "Name", "Year", "Rewatch"],
      diaryEntries.map((d) => [
        d.watchedDate.toISOString().slice(0, 10),
        d.movie.title,
        d.movie.releaseDate?.slice(0, 4) ?? "",
        d.rewatch ? "Yes" : "No",
      ])
    )
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
