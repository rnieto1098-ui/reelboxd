import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";
import { createDiaryEntry } from "@/lib/diary";

// Letterboxd blocks requests without a browser-like User-Agent (a bare
// Node fetch gets a 403), so this has to look like an actual browser.
const RSS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function extractTag(source: string, tag: string): string | null {
  const match = source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ?? null;
}

// A nonexistent or deactivated username serves an HTML error page rather
// than a 404 — this is how that's told apart from a real feed. Letterboxd
// has no private-profile concept for diary RSS (a private account's feed
// just isn't published), so there's no separate "private" case to handle.
function looksLikeRss(xml: string): boolean {
  return /<rss[\s>]/.test(xml) || /<channel[\s>]/.test(xml);
}

type FeedEntry = {
  guid: string;
  tmdbId: number | null;
  watchedDate: string; // YYYY-MM-DD
  rewatch: boolean;
  rating: number | null;
  liked: boolean;
};

function parseFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];

  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    if (!item) continue;

    const guid = (extractTag(item, "guid") ?? "").trim();
    const watchedDate = (extractTag(item, "letterboxd:watchedDate") ?? "").trim();
    if (!guid || !watchedDate) continue;

    const tmdbRaw = extractTag(item, "tmdb:movieId");
    const tmdbId = tmdbRaw ? Number(tmdbRaw.trim()) : NaN;

    const ratingRaw = extractTag(item, "letterboxd:memberRating");
    const rating = ratingRaw ? Number.parseFloat(ratingRaw.trim()) : NaN;

    entries.push({
      guid,
      tmdbId: Number.isFinite(tmdbId) ? tmdbId : null,
      watchedDate,
      rewatch: (extractTag(item, "letterboxd:rewatch") ?? "").trim() === "Yes",
      rating: Number.isFinite(rating) ? rating : null,
      liked: (extractTag(item, "letterboxd:memberLike") ?? "").trim() === "Yes",
    });
  }

  return entries;
}

export async function fetchLetterboxdDiaryFeed(username: string): Promise<FeedEntry[]> {
  const res = await fetch(`https://letterboxd.com/${encodeURIComponent(username)}/rss/`, {
    headers: {
      "User-Agent": RSS_USER_AGENT,
      Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error(`Couldn't find a Letterboxd profile for "${username}".`);
  }
  if (!res.ok) {
    throw new Error("Couldn't reach Letterboxd right now — try again in a bit.");
  }

  const xml = await res.text();
  if (!looksLikeRss(xml)) {
    throw new Error(`Couldn't find a Letterboxd profile for "${username}".`);
  }

  return parseFeed(xml);
}

export type LetterboxdSyncSummary = {
  imported: number;
  ratingsImported: number;
  likesImported: number;
  skipped: number;
};

// Pulls the user's Letterboxd diary RSS and creates any log entries that
// haven't been synced yet (tracked by LetterboxdSyncItem, keyed on
// Letterboxd's own guid for each entry). A diary log's inline rating/like on
// Letterboxd become a Rating/Like row here too — same combined action the
// movie page's own log flow already supports, just driven by Letterboxd's
// data instead of a click. One-way only: nothing here ever writes back to
// Letterboxd.
//
// Deliberately skips the challenge/goal "just completed" checks that a live
// diary log triggers — those are cheap for one click, not for a sync that
// can import dozens of entries in a single run (worse on a first sync).
export async function syncLetterboxdDiary(
  userId: string,
  username: string
): Promise<LetterboxdSyncSummary> {
  const entries = await fetchLetterboxdDiaryFeed(username);

  const alreadySynced = await prisma.letterboxdSyncItem.findMany({
    where: { userId },
    select: { guid: true },
  });
  const seenGuids = new Set(alreadySynced.map((r) => r.guid));

  const summary: LetterboxdSyncSummary = {
    imported: 0,
    ratingsImported: 0,
    likesImported: 0,
    skipped: 0,
  };

  for (const entry of entries) {
    if (seenGuids.has(entry.guid)) continue;

    if (entry.tmdbId == null) {
      summary.skipped++;
      continue;
    }

    const movie = await ensureMovieCached(entry.tmdbId).catch(() => null);
    if (!movie) {
      summary.skipped++;
      continue;
    }

    await createDiaryEntry({
      userId,
      movieId: movie.id,
      watchedDate: new Date(`${entry.watchedDate}T00:00:00.000Z`),
      rewatch: entry.rewatch,
    });
    summary.imported++;

    if (entry.rating != null) {
      await prisma.rating.upsert({
        where: { userId_movieId: { userId, movieId: movie.id } },
        update: { score: entry.rating },
        create: { userId, movieId: movie.id, score: entry.rating },
      });
      summary.ratingsImported++;
    }

    if (entry.liked) {
      await prisma.like.upsert({
        where: { userId_movieId: { userId, movieId: movie.id } },
        update: {},
        create: { userId, movieId: movie.id },
      });
      summary.likesImported++;
    }

    await prisma.letterboxdSyncItem.create({ data: { userId, guid: entry.guid } });
  }

  await prisma.user.update({ where: { id: userId }, data: { letterboxdSyncedAt: new Date() } });

  return summary;
}
