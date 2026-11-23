// Where "Watch on …" sends you from the Couch TV.
//
// TMDB has no direct links to a film inside Netflix, Max and the rest. The
// next best thing is a service's own search, opened on the film's title:
// one tap from the film, and on a phone it often opens the service's app.
//
// Prime Video, Starz, HBO Max, MGM+ and AMC+ all go to Prime Video's
// search: the last four are sold as Prime Video Channels, so a Prime
// account plays them from one place, and so does any other service TMDB
// lists as an "Amazon Channel".
//
// Services whose search page couldn't be confirmed to take a query
// (checked November 2026: Disney+ 404s) fall back to TMDB's "where to
// watch" page, which links to the exact title through JustWatch.

const primeVideo = (q: string) => `https://www.primevideo.com/search?phrase=${q}`;

// TMDB provider ids, from its US watch-provider list.
const PRIME_VIDEO_IDS = new Set([
  9, 2100, 613, // Prime Video, with ads, free with ads
  43, 1794, // Starz, Starz Amazon Channel
  1899, 1825, // HBO Max, HBO Max Amazon Channel
  34, 583, // MGM+, MGM+ Amazon Channel
  526, 528, // AMC+, AMC+ Amazon Channel
  2745, // Sony Pictures Core Amazon Channel (shown as "Sony Pictures Core")
]);

const SEARCH_URLS: Record<number, (q: string) => string> = {
  8: (q) => `https://www.netflix.com/search?q=${q}`, // Netflix
  1796: (q) => `https://www.netflix.com/search?q=${q}`, // Netflix with ads
  15: (q) => `https://www.hulu.com/search?q=${q}`, // Hulu
  350: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV+
  2: (q) => `https://tv.apple.com/search?term=${q}`, // Apple TV
  531: (q) => `https://www.paramountplus.com/search/?q=${q}`, // Paramount+
  386: (q) => `https://www.peacocktv.com/watch/search?q=${q}`, // Peacock
  387: (q) => `https://www.peacocktv.com/watch/search?q=${q}`, // Peacock Premium Plus
};

/** Whether this service's films open in Prime Video. */
export function watchesOnPrimeVideo(providerId: number, providerName = ""): boolean {
  return PRIME_VIDEO_IDS.has(providerId) || /amazon channel/i.test(providerName);
}

export function serviceSearchUrl(providerId: number, title: string, providerName = ""): string | null {
  const q = encodeURIComponent(title);
  if (watchesOnPrimeVideo(providerId, providerName)) return primeVideo(q);
  const build = SEARCH_URLS[providerId];
  return build ? build(q) : null;
}

/**
 * The best link out for a film on a service: its search, else TMDB's watch
 * page. `label` is the place it opens, which for the Prime Video Channels
 * is Prime Video rather than the service's own name.
 */
export function watchLink(
  service: { id: number; name: string },
  title: string,
  tmdbWatchLink: string | null
): { href: string; direct: boolean; label: string } | null {
  const search = serviceSearchUrl(service.id, title, service.name);
  if (search) {
    return {
      href: search,
      direct: true,
      label: watchesOnPrimeVideo(service.id, service.name) ? "Prime Video" : service.name,
    };
  }
  return tmdbWatchLink ? { href: tmdbWatchLink, direct: false, label: service.name } : null;
}
