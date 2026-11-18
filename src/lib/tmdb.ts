const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type TmdbMovieSummary = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  genre_ids?: number[];
  popularity?: number;
};

export type TmdbGenre = { id: number; name: string };

export type TmdbCastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

export type TmdbCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
};

export type TmdbProductionCompany = {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
};

export type TmdbMovieDetails = TmdbMovieSummary & {
  runtime: number | null;
  genres: TmdbGenre[];
  tagline: string;
  production_companies?: TmdbProductionCompany[];
  credits?: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: { certification: string; type: number }[];
    }[];
  };
  keywords?: { keywords: { id: number; name: string }[] };
  videos?: { results: TmdbVideo[] };
};

export type TmdbVideo = {
  key: string;
  name: string;
  site: string; // "YouTube" | "Vimeo"
  type: string; // "Trailer" | "Teaser" | "Clip" | "Featurette" | ...
  official: boolean;
  published_at?: string;
};

/**
 * The best video to put behind a "Watch trailer" button: an official
 * YouTube trailer if there is one, then any trailer, then a teaser. Returns
 * null when TMDB has nothing suitable, in which case there is no button.
 */
export function pickTrailer(details: TmdbMovieDetails): TmdbVideo | null {
  const youtube = (details.videos?.results ?? []).filter((v) => v.site === "YouTube" && v.key);
  const rank = (v: TmdbVideo) =>
    (v.type === "Trailer" ? 0 : v.type === "Teaser" ? 2 : 4) + (v.official ? 0 : 1);
  const candidates = youtube.filter((v) => v.type === "Trailer" || v.type === "Teaser");
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => rank(a) - rank(b))[0];
}

export type TmdbImage = {
  file_path: string;
  width: number;
  height: number;
  vote_average: number;
  iso_639_1: string | null;
};

export type TmdbWatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority?: number;
  display_priorities?: Record<string, number>;
};

export type TmdbWatchProviderResults = {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
};

export type TmdbListResponse = {
  page: number;
  results: TmdbMovieSummary[];
  total_pages: number;
  total_results: number;
};

// A single homepage load can fan out into dozens of TMDB calls at once
// (multi-page rows, genre rows, recommendations, ...) — without a cap,
// concurrent real users multiply that into a burst big enough to trip
// TMDB's rate limit. This gates ALL tmdbFetch calls through one queue
// (per server instance) so at most MAX_CONCURRENT are ever in flight,
// regardless of how many callers fire at once.
// 10 in flight at ~100–250ms each stays well under TMDB's ~40-50 req/s
// per-IP limit (and 429s are retried with backoff below); 6 left a cold
// home page waiting several seconds in this queue.
const MAX_CONCURRENT_REQUESTS = 10;
let activeRequests = 0;
const requestQueue: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) next();
}

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 8000;
// However long TMDB asks us to wait, a page render won't sit longer than this.
const MAX_BACKOFF_MS = 4000;

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  revalidateSeconds = 60 * 60
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TMDB_API_KEY is not set. Add it to your .env file (see .env.example)."
    );
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // The slot is held only for the request itself. It used to stay taken
    // through the back-off sleep below, so a burst of 429s could park every
    // slot on a timer and stall all TMDB traffic on the instance.
    await acquireSlot();
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        next: { revalidate: revalidateSeconds },
        // A hung connection would otherwise hold its slot (and the page
        // waiting on it) until the platform killed the whole request.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } finally {
      releaseSlot();
    }

    if (res.ok) return res.json() as Promise<T>;

    // 429 is the only status worth retrying — TMDB tells us how long to
    // back off via Retry-After; anything else (400/401/404/5xx) won't be
    // fixed by waiting, so fail immediately.
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterSeconds = Number(res.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 500 * 2 ** attempt; // 500ms, 1s, 2s if TMDB doesn't say
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, MAX_BACKOFF_MS)));
      continue;
    }

    throw new Error(`TMDB request failed (${res.status}): ${path}`);
  }
  // Unreachable — the loop above always returns or throws — but keeps
  // TypeScript satisfied that every path returns T.
  throw new Error(`TMDB request failed after ${MAX_RETRIES} retries: ${path}`);
}

export function posterUrl(path: string | null, size: "w200" | "w342" | "w500" = "w342") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(
  path: string | null,
  size: "w780" | "w1280" | "original" = "w1280"
) {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function profileUrl(path: string | null, size: "w45" | "w185" | "h632" = "w185") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function logoUrl(path: string | null, size: "w45" | "w92" | "w154" = "w92") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function getPopularMovies(page = 1) {
  return tmdbFetch<TmdbListResponse>("/movie/popular", { page });
}

// Dedupes across pages (TMDB result lists can overlap slightly at the
// boundary as rankings shift) while preserving original page order. TMDB's
// API occasionally 500s on an individual page (seen in practice on deep
// pages of some /discover/movie queries) — one flaky page shouldn't crash
// a whole homepage row, so failed pages are silently dropped rather than
// rejecting the whole batch.
async function mergeSettledPages(
  requests: Promise<TmdbListResponse>[]
): Promise<TmdbMovieSummary[]> {
  const settled = await Promise.allSettled(requests);
  const seen = new Set<number>();
  const merged: TmdbMovieSummary[] = [];
  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") continue;
    for (const movie of outcome.value.results) {
      if (!seen.has(movie.id)) {
        seen.add(movie.id);
        merged.push(movie);
      }
    }
  }
  return merged;
}

// Fetches several pages in parallel and flattens them into one list — used
// for homepage rows so there's enough raw pool left over after a client-side
// filter (e.g. streaming availability) narrows it down.
export async function getPopularMoviesMultiPage(pages: number): Promise<TmdbMovieSummary[]> {
  return mergeSettledPages(Array.from({ length: pages }, (_, i) => getPopularMovies(i + 1)));
}

export function getTopRatedMovies(page = 1) {
  return tmdbFetch<TmdbListResponse>("/movie/top_rated", { page });
}

// TMDB's own /movie/upcoming endpoint is region-gated and often includes
// movies that already released in other regions, so this discovers by date
// range instead: unreleased-as-of-today, ordered by popularity. No vote-count
// floor — unreleased movies have few or no votes yet.
export function getUpcomingMovies(page = 1) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 120);
  return tmdbFetch<TmdbListResponse>("/discover/movie", {
    "primary_release_date.gte": tomorrow.toISOString().slice(0, 10),
    "primary_release_date.lte": horizon.toISOString().slice(0, 10),
    sort_by: "popularity.desc",
    page,
  });
}

export function getTrendingMovies(window: "day" | "week" = "week", page = 1) {
  return tmdbFetch<TmdbListResponse>(`/trending/movie/${window}`, { page });
}

export async function getTrendingMoviesMultiPage(
  window: "day" | "week",
  pages: number
): Promise<TmdbMovieSummary[]> {
  return mergeSettledPages(
    Array.from({ length: pages }, (_, i) => getTrendingMovies(window, i + 1))
  );
}

export function searchMovies(query: string, page = 1, year?: number) {
  return tmdbFetch<TmdbListResponse>("/search/movie", {
    query,
    page,
    primary_release_year: year,
  });
}

export function getMovieDetails(tmdbId: number) {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: "credits,release_dates,keywords,videos",
  });
}

// US MPA rating (e.g. "R", "PG-13") straight from TMDB's release_dates data
// — a movie can have several US release entries (festival, theatrical,
// digital, physical, ...) and only some carry a certification, so this
// takes the first non-empty one.
export function getUsCertification(details: TmdbMovieDetails): string | null {
  const us = details.release_dates?.results.find((r) => r.iso_3166_1 === "US");
  const cert = us?.release_dates.find((rd) => rd.certification)?.certification;
  return cert || null;
}

// The genre list changes essentially never, and gets fetched on nearly every
// page (home rows, Recommend Me, movie pages, ...) — an in-memory cache on
// top of Next's per-URL fetch cache means a warm server instance serves it
// from memory instead of re-hitting TMDB, including from Route Handlers
// (like /api/recommend) where React's request-scoped `cache()` doesn't apply.
let genreCache: { data: { genres: TmdbGenre[] }; expiresAt: number } | null = null;
const GENRE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getGenres() {
  if (genreCache && genreCache.expiresAt > Date.now()) return genreCache.data;
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>("/genre/movie/list");
  genreCache = { data, expiresAt: Date.now() + GENRE_CACHE_TTL_MS };
  return data;
}

export function discoverMoviesByGenre(genreId: number, page = 1) {
  return tmdbFetch<TmdbListResponse>("/discover/movie", {
    with_genres: genreId,
    sort_by: "popularity.desc",
    page,
  });
}

export function discoverMovies(params: {
  genreIds?: number[];
  // TMDB has no "Superhero" genre (or similar fine-grained categories) —
  // its own keyword tagging (e.g. id 9715, "superhero") is the precise
  // signal for those, versus with_genres matching on the much broader
  // Action/Adventure genre a superhero movie also happens to carry.
  keywordIds?: number[];
  // Genres a result must NOT carry (TMDB without_genres).
  excludeGenreIds?: number[];
  minVoteAverage?: number;
  minVoteCount?: number;
  minRuntime?: number;
  maxRuntime?: number;
  year?: number;
  sortBy?: string;
  page?: number;
  castId?: number;
  crewId?: number;
  // US MPAA rating cap (e.g. "PG-13" or "R") — TMDB resolves the actual
  // G/PG/PG-13/R/NC-17 ordering server-side, so this is a real severity cap
  // rather than a string comparison. certificationCountry is required
  // alongside it for the filter to take effect.
  certificationCountry?: string;
  maxCertification?: string;
  // Only films streaming (flatrate) on at least one of these TMDB provider
  // ids in watchRegion. Joined with "|" — TMDB's OR — so it means "on any of
  // my services", not "on all of them".
  watchProviderIds?: number[];
  watchRegion?: string;
  // Genres where ANY match counts (TMDB "|"), unlike genreIds above, which
  // TMDB treats as "has every one of these".
  anyGenreIds?: number[];
  // People where any match counts — a film with this director OR that actor.
  anyPeopleIds?: number[];
  maxVoteCount?: number;
  releasedAfter?: string; // YYYY-MM-DD
  releasedBefore?: string; // YYYY-MM-DD
  // Homepage rows like "Highest Rated" and the genre rows barely shift
  // hour to hour — letting those sit in cache longer than the default 1hr
  // cuts TMDB request volume without the data feeling stale. Callers where
  // freshness actually matters (search, recommend, crew filmography) just
  // don't pass this and get the default.
  revalidateSeconds?: number;
}) {
  return tmdbFetch<TmdbListResponse>(
    "/discover/movie",
    {
      with_genres:
        params.anyGenreIds && params.anyGenreIds.length > 0
          ? params.anyGenreIds.join("|")
          : params.genreIds && params.genreIds.length > 0
            ? params.genreIds.join(",")
            : undefined,
      with_people:
        params.anyPeopleIds && params.anyPeopleIds.length > 0
          ? params.anyPeopleIds.join("|")
          : undefined,
      with_watch_providers:
        params.watchProviderIds && params.watchProviderIds.length > 0
          ? params.watchProviderIds.join("|")
          : undefined,
      watch_region:
        params.watchProviderIds && params.watchProviderIds.length > 0
          ? (params.watchRegion ?? "US")
          : undefined,
      with_watch_monetization_types:
        params.watchProviderIds && params.watchProviderIds.length > 0 ? "flatrate" : undefined,
      "vote_count.lte": params.maxVoteCount,
      "primary_release_date.gte": params.releasedAfter,
      "primary_release_date.lte": params.releasedBefore,
      with_keywords:
        params.keywordIds && params.keywordIds.length > 0 ? params.keywordIds.join(",") : undefined,
      without_genres:
        params.excludeGenreIds && params.excludeGenreIds.length > 0
          ? params.excludeGenreIds.join(",")
          : undefined,
      "vote_average.gte": params.minVoteAverage,
      "vote_count.gte": params.minVoteCount ?? 100,
      "with_runtime.gte": params.minRuntime,
      "with_runtime.lte": params.maxRuntime,
      primary_release_year: params.year,
      sort_by: params.sortBy ?? "popularity.desc",
      page: params.page ?? 1,
      with_cast: params.castId,
      with_crew: params.crewId,
      certification_country: params.certificationCountry,
      "certification.lte": params.maxCertification,
    },
    params.revalidateSeconds
  );
}

export async function discoverMoviesMultiPage(
  params: Parameters<typeof discoverMovies>[0],
  pages: number
): Promise<TmdbMovieSummary[]> {
  return mergeSettledPages(
    Array.from({ length: pages }, (_, i) => discoverMovies({ ...params, page: i + 1 }))
  );
}

export function getMovieImages(tmdbId: number) {
  return tmdbFetch<{ posters: TmdbImage[] }>(`/movie/${tmdbId}/images`);
}

// Deliberately hits /recommendations, not /similar — verified directly
// against several movies that /similar is metadata-matched (genre/keyword)
// and often returns near-nonsense (Fight Club -> a 1957 crime B-movie, a
// ballet documentary), while /recommendations (based on real user co-viewing
// patterns) consistently returns genuinely related films (Fight Club ->
// Requiem for a Dream, Trainspotting, Sin City).
export function getSimilarMovies(tmdbId: number, page = 1) {
  return tmdbFetch<TmdbListResponse>(`/movie/${tmdbId}/recommendations`, { page });
}

// Streaming availability shifts on the scale of days, not hours (the daily
// provider-snapshot cron runs on the same assumption), and the home page's
// Discover / Rent or Buy rows look this up for dozens of films per load, so
// a day-long cache keeps those lookups from going cold every hour.
const WATCH_PROVIDERS_CACHE_SECONDS = 24 * 60 * 60;

export function getWatchProviders(tmdbId: number) {
  return tmdbFetch<{ results: Record<string, TmdbWatchProviderResults> }>(
    `/movie/${tmdbId}/watch/providers`,
    {},
    WATCH_PROVIDERS_CACHE_SECONDS
  );
}

export function getWatchProviderCatalog(region: string) {
  return tmdbFetch<{ results: TmdbWatchProvider[] }>("/watch/providers/movie", {
    watch_region: region,
  });
}

export type TmdbPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department?: string;
  popularity?: number;
  // Only on /person/popular results: the few titles TMDB thinks they're
  // best known for.
  known_for?: { original_language?: string; vote_count?: number; media_type?: string }[];
};

export type TmdbCompany = {
  id: number;
  name: string;
  logo_path: string | null;
};

export function getPopularPeople(page = 1) {
  return tmdbFetch<{ results: TmdbPerson[]; total_pages: number }>("/person/popular", { page });
}

export function searchPeople(query: string, page = 1) {
  return tmdbFetch<{ results: TmdbPerson[]; total_results: number }>("/search/person", {
    query,
    page,
  });
}

export function searchCompanies(query: string, page = 1) {
  return tmdbFetch<{ results: TmdbCompany[]; total_results: number }>("/search/company", {
    query,
    page,
  });
}

export type TmdbPersonDetails = TmdbPerson & {
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
};

export function getPersonDetails(personId: number) {
  return tmdbFetch<TmdbPersonDetails>(`/person/${personId}`);
}

export type TmdbCastCredit = {
  id: number;
  title: string;
  character: string;
  poster_path: string | null;
  release_date: string;
  popularity?: number;
  vote_average?: number;
};

export type TmdbCrewCredit = {
  id: number;
  title: string;
  job: string;
  department: string;
  poster_path: string | null;
  release_date: string;
  popularity?: number;
  vote_average?: number;
};

export function getPersonMovieCredits(personId: number) {
  return tmdbFetch<{ cast: TmdbCastCredit[]; crew: TmdbCrewCredit[] }>(
    `/person/${personId}/movie_credits`
  );
}

export type TmdbCompanyDetails = {
  id: number;
  name: string;
  logo_path: string | null;
  description: string;
  headquarters: string;
  origin_country: string;
};

export function getCompanyDetails(companyId: number) {
  return tmdbFetch<TmdbCompanyDetails>(`/company/${companyId}`);
}

export function discoverMoviesByCompany(companyId: number, page = 1) {
  return tmdbFetch<TmdbListResponse>("/discover/movie", {
    with_companies: companyId,
    sort_by: "popularity.desc",
    page,
  });
}
