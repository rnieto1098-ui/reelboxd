import JSZip from "jszip";
import { prisma } from "@/lib/prisma";

// Mirrors the columns letterboxdImport.ts reads (Name, Year, Rating) — an
// export can be re-imported straight back into Flixtally, and uses the same
// header names Letterboxd's own export uses, so it's a reasonable stand-in
// there too even though full compatibility with Letterboxd's own importer
// isn't guaranteed.
function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function exportUserDataZip(userId: string): Promise<Buffer> {
  const [ratings, watchlist, diaryEntries] = await Promise.all([
    prisma.rating.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      include: { movie: true },
      orderBy: { addedAt: "asc" },
    }),
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

  zip.file(
    "watchlist.csv",
    toCsv(
      ["Date", "Name", "Year"],
      watchlist.map((w) => [
        w.addedAt.toISOString().slice(0, 10),
        w.movie.title,
        w.movie.releaseDate?.slice(0, 4) ?? "",
      ])
    )
  );

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
