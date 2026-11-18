// Where "Watch on …" sends you from the Couch TV.
//
// TMDB has no direct links to a film inside Netflix, Max and the rest. The
// next best thing is each service's own search, opened on the film's title:
// one tap from the film, and on a phone it often opens the service's app.
// Services whose search page couldn't be confirmed to take a query (checked
// November 2026: Disney+ 404s, Max drops the query) fall back to TMDB's
// "where to watch" page, which links to the exact title through JustWatch.

const SEARCH_URLS: Record<number, (q: string) => string> = {
  8: (q) => `https://www.netflix.com/search?q=${q}`, // Netflix
  1796: (q) => `https://www.netflix.com/search?q=${q}`, // Netflix with ads
  9: (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`, // Prime Video
  2100: (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`, // Prime Video with ads
  15: (q) => `https://www.hulu.com/search?q=${q}`, // Hulu
  350: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV+
  2: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV
  531: (q) => `https://www.paramountplus.com/search/?q=${q}`, // Paramount+
  386: (q) => `https://www.peacocktv.com/watch/search?q=${q}`, // Peacock
  387: (q) => `https://www.peacocktv.com/watch/search?q=${q}`, // Peacock Premium Plus
};

export function serviceSearchUrl(providerId: number, title: string): string | null {
  const build = SEARCH_URLS[providerId];
  return build ? build(encodeURIComponent(title)) : null;
}

/** The best link out for a film on a service: its search, else TMDB's watch page. */
export function watchLink(
  providerId: number,
  title: string,
  tmdbWatchLink: string | null
): { href: string; direct: boolean } | null {
  const search = serviceSearchUrl(providerId, title);
  if (search) return { href: search, direct: true };
  return tmdbWatchLink ? { href: tmdbWatchLink, direct: false } : null;
}
