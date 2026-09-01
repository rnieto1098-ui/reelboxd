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
};

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
const MAX_CONCURRENT_REQUESTS = 6;
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

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {}
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

  await acquireSlot();
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url.toString(), {
        next: { revalidate: 60 * 60 }, // cache TMDB responses for an hour
      });

      if (res.ok) return res.json() as Promise<T>;

      // 429 is the only status worth retrying — TMDB tells us exactly how
      // long to back off via Retry-After; anything else (400/401/404/5xx)
      // won't be fixed by waiting, so fail immediately.
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfterSeconds = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 500 * 2 ** attempt; // 500ms, 1s, 2s if TMDB doesn't say
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      throw new Error(`TMDB request failed (${res.status}): ${path}`);
    }
    // Unreachable — the loop above always returns or throws — but keeps
    // TypeScript satisfied that every path returns T.
    throw new Error(`TMDB request failed after ${MAX_RETRIES} retries: ${path}`);
  } finally {
    releaseSlot();
  }
}

export function posterUrl(path: string | null, size: "w200" | "w342" | "w500" = "w342") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: "w780" | "w1280" = "w1280") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function profileUrl(path: string | null, size: "w45" | "w185" = "w185") {
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
    append_to_response: "credits,release_dates,keywords",
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
}) {
  return tmdbFetch<TmdbListResponse>("/discover/movie", {
    with_genres:
      params.genreIds && params.genreIds.length > 0 ? params.genreIds.join(",") : undefined,
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
  });
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

export function getWatchProviders(tmdbId: number) {
  return tmdbFetch<{ results: Record<string, TmdbWatchProviderResults> }>(
    `/movie/${tmdbId}/watch/providers`
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
