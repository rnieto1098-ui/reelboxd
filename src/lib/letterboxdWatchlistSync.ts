import { prisma } from "@/lib/prisma";
import { ensureMovieCached } from "@/lib/movies";

// Same UA trick the diary RSS sync needs — Letterboxd blocks non-browser
// requests outright.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Unlike the diary sync (a stable RSS format), this reads Letterboxd's
// actual watchlist page markup — there's no contract that stays the same.
// Hard caps here aren't about correctness, they're about never letting one
// user's watchlist turn into an unbounded fetch storm against Letterboxd if
// something about the pagination logic goes wrong.
const MAX_PAGES = 60; // 60 * 28 ~= 1,680 films
const RESOLVE_CONCURRENCY = 4;
// A first-ever sync of a long watchlist resolves gradually across runs
// rather than in one burst — gentler on Letterboxd, and caps how bad one
// run's blast radius is if something's wrong.
const MAX_NEW_FILMS_PER_RUN = 60;

// Thrown when a sync run can't make sense of the watchlist page at all —
// distinct from a network/not-found error, and from a genuinely empty
// watchlist (which parses fine and just yields zero films). This is the
// signal that drives the "sync broke" notification.
export class LetterboxdWatchlistBrokenError extends Error {}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

type WatchlistEntry = { slug: string; name: string };

function parseWatchlistPage(html: string): WatchlistEntry[] {
  const entries: WatchlistEntry[] = [];
  const posterRe = /<div class="react-component" data-component-class="LazyPoster"([^>]*)>/g;
  for (const match of html.matchAll(posterRe)) {
    const attrs = match[1];
    const slug = attrs.match(/data-item-slug="([^"]*)"/)?.[1];
    const name =
      attrs.match(/data-item-full-display-name="([^"]*)"/)?.[1] ??
      attrs.match(/data-item-name="([^"]*)"/)?.[1];
    if (slug) entries.push({ slug, name: decodeHtmlEntities(name ?? slug) });
  }
  return entries;
}

function nextPageUrl(html: string): string | null {
  const match = html.match(/paginate-nextprev"><a class="next" href="([^"]+)"/);
  return match ? `https://letterboxd.com${match[1]}` : null;
}

async function fetchWatchlistAllPages(username: string): Promise<WatchlistEntry[]> {
  let url = `https://letterboxd.com/${encodeURIComponent(username)}/watchlist/`;
  const entries: WatchlistEntry[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });
    if (res.status === 404) {
      throw new Error(`Couldn't find a Letterboxd profile for "${username}".`);
    }
    if (!res.ok) {
      throw new LetterboxdWatchlistBrokenError(`Letterboxd returned ${res.status} for the watchlist page.`);
    }

    const html = await res.text();
    // The one structural guarantee this whole feature leans on: if this
    // marker is gone, Letterboxd changed something and every attribute
    // name below is suspect — better to stop and report than to silently
    // parse zero films and read that as "watchlist is empty."
    if (!html.includes("js-watchlist-content")) {
      throw new LetterboxdWatchlistBrokenError(
        "The watchlist page didn't look like Letterboxd's usual layout."
      );
    }

    entries.push(...parseWatchlistPage(html));

    const next = nextPageUrl(html);
    if (!next) break;
    url = next;
  }

  return entries;
}

async function resolveTmdbId(slug: string): Promise<number | null> {
  const cached = await prisma.letterboxdFilmMapping.findUnique({ where: { filmSlug: slug } });
  if (cached) return cached.tmdbId;

  try {
    const res = await fetch(`https://letterboxd.com/film/${slug}/`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/themoviedb\.org\/movie\/(\d+)/);
    const tmdbId = match ? Number(match[1]) : null;
    if (tmdbId == null) return null;

    await prisma.letterboxdFilmMapping.upsert({
      where: { filmSlug: slug },
      update: {},
      create: { filmSlug: slug, tmdbId },
    });
    return tmdbId;
  } catch {
    return null;
  }
}

export type LetterboxdWatchlistSyncSummary = {
  added: number;
  unmatched: string[];
  // True when there were more new films than MAX_NEW_FILMS_PER_RUN could
  // resolve this run — they'll pick up on the next sync instead of all at
  // once.
  remaining: number;
};

/**
 * Pulls the user's Letterboxd watchlist and adds any film not already known
 * to be synced (tracked by LetterboxdWatchlistItem, keyed on Letterboxd's
 * film slug) to their Flixtally watchlist. Add-only by design: a film that
 * drops off the Letterboxd watchlist is never removed from Flixtally here —
 * see the schema comment on User.letterboxdWatchlistSyncBroken for why
 * (a parsing failure must never look like "the watchlist is now empty").
 *
 * Throws LetterboxdWatchlistBrokenError if the page structure looks wrong
 * rather than guessing — callers should treat that as "don't trust
 * anything from this run," not as a normal empty result.
 */
export async function syncLetterboxdWatchlist(
  userId: string,
  username: string
): Promise<LetterboxdWatchlistSyncSummary> {
  const [entries, alreadySynced] = await Promise.all([
    fetchWatchlistAllPages(username),
    prisma.letterboxdWatchlistItem.findMany({ where: { userId }, select: { filmSlug: true } }),
  ]);

  const seenSlugs = new Set(alreadySynced.map((r) => r.filmSlug));
  const newEntries = entries.filter((e) => !seenSlugs.has(e.slug));
  const toProcess = newEntries.slice(0, MAX_NEW_FILMS_PER_RUN);

  const unmatched: string[] = [];
  let added = 0;

  for (let i = 0; i < toProcess.length; i += RESOLVE_CONCURRENCY) {
    const batch = toProcess.slice(i, i + RESOLVE_CONCURRENCY);
    await Promise.all(
      batch.map(async (entry) => {
        const tmdbId = await resolveTmdbId(entry.slug);
        if (tmdbId == null) {
          unmatched.push(entry.name);
          return;
        }

        const movie = await ensureMovieCached(tmdbId);
        await Promise.all([
          prisma.watchlistItem.upsert({
            where: { userId_movieId: { userId, movieId: movie.id } },
            update: {},
            create: { userId, movieId: movie.id },
          }),
          prisma.letterboxdWatchlistItem.create({ data: { userId, filmSlug: entry.slug } }),
        ]);
        added++;
      })
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { letterboxdWatchlistSyncedAt: new Date(), letterboxdWatchlistSyncBroken: false },
  });

  return { added, unmatched, remaining: newEntries.length - toProcess.length };
}
