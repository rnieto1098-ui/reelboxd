import { prisma } from "@/lib/prisma";
import { ensureMovieCached, parseGenres } from "@/lib/movies";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { filterMoviesByStreaming, getUserOwnedTmdbIds, getUserProviderIds } from "@/lib/streaming";
import {
  discoverMovies,
  getGenres,
  getSimilarMovies,
  searchMovies,
  type TmdbMovieSummary,
} from "@/lib/tmdb";

// Words/phrases that hint at a genre but aren't the TMDB genre name itself.
const GENRE_ALIASES: Record<string, string> = {
  "sci-fi": "Science Fiction",
  scifi: "Science Fiction",
  "sci fi": "Science Fiction",
  "rom-com": "Romance",
  romcom: "Romance",
  "romantic comedy": "Romance",
  scary: "Horror",
  spooky: "Horror",
  creepy: "Horror",
  funny: "Comedy",
  hilarious: "Comedy",
  romantic: "Romance",
  "true story": "Documentary",
  documentary: "Documentary",
  musical: "Music",
  superhero: "Action",
  whodunit: "Mystery",
  heist: "Crime",
};

export type ParsedPrompt = {
  genreIds: number[];
  genreNames: string[];
  runtimeMaxMinutes: number | null;
  runtimeMinMinutes: number | null;
  minRating10: number | null;
  similarToQuery: string | null;
  onlyWatchlist: boolean;
  onlyStreaming: boolean;
  // US MPAA cap: true = R or below (the default), false = PG-13 or below.
  allowR: boolean;
};

function toMinutes(value: number, unit: string): number {
  return unit.startsWith("h") ? Math.round(value * 60) : Math.round(value);
}

export type PromptPresets = {
  genreNames?: string[];
  maxRuntimeMinutes?: number | null;
  onlyWatchlist?: boolean;
  onlyStreaming?: boolean;
  allowR?: boolean;
  // Movie ids to leave out of the results — sent when the user hits
  // "Recommend me something" again without changing any criteria, so a
  // repeat click surfaces a fresh set instead of the same one.
  excludeIds?: number[];
};

export async function parsePrompt(prompt: string, presets?: PromptPresets): Promise<ParsedPrompt> {
  const lower = prompt.toLowerCase();
  const { genres: allGenres } = await getGenres();
  const validGenreNames = new Set(allGenres.map((g) => g.name));

  const matchedGenreNames = new Set<string>();
  for (const genre of allGenres) {
    if (lower.includes(genre.name.toLowerCase())) matchedGenreNames.add(genre.name);
  }
  for (const [alias, genreName] of Object.entries(GENRE_ALIASES)) {
    if (lower.includes(alias)) {
      matchedGenreNames.add(genreName);
      if (alias.includes("rom")) matchedGenreNames.add("Comedy");
    }
  }
  // Preset genre chips (clicked directly, not typed) — union in on top of
  // whatever the free-text prompt matched.
  for (const name of presets?.genreNames ?? []) {
    if (validGenreNames.has(name)) matchedGenreNames.add(name);
  }
  const genreIds = allGenres.filter((g) => matchedGenreNames.has(g.name)).map((g) => g.id);

  let runtimeMaxMinutes: number | null = null;
  let runtimeMinMinutes: number | null = null;

  const maxMatch = lower.match(
    /(?:under|less than|shorter than|no more than|at most|max(?:imum)?)\s+(\d+(?:\.\d+)?)\s*(hour|hr|h\b|minute|min|m\b)/
  );
  if (maxMatch) runtimeMaxMinutes = toMinutes(parseFloat(maxMatch[1]), maxMatch[2]);

  const minMatch = lower.match(
    /(?:over|more than|longer than|at least|minimum)\s+(\d+(?:\.\d+)?)\s*(hour|hr|h\b|minute|min|m\b)/
  );
  if (minMatch) runtimeMinMinutes = toMinutes(parseFloat(minMatch[1]), minMatch[2]);

  if (!runtimeMaxMinutes && !runtimeMinMinutes) {
    const bare = lower.match(/(\d+(?:\.\d+)?)\s*(hour|hr|h\b)(?:\s*(\d+)\s*(minute|min))?/);
    if (bare) {
      const hrs = parseFloat(bare[1]);
      const mins = bare[3] ? parseFloat(bare[3]) : 0;
      runtimeMaxMinutes = Math.round(hrs * 60 + mins) + 10;
    }
  }

  let minRating10: number | null = null;
  const ratingMatch = lower.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:star|rating)/);
  if (ratingMatch) {
    const val = parseFloat(ratingMatch[1]);
    minRating10 = val <= 5 ? val * 2 : Math.min(val, 10);
  } else if (/highly rated|critically acclaimed|well[- ]reviewed|great reviews/.test(lower)) {
    minRating10 = 7;
  }

  // Preset runtime chip — combines with a text-parsed cap by taking
  // whichever is more restrictive, same "AND" semantics as everything else.
  if (presets?.maxRuntimeMinutes) {
    runtimeMaxMinutes = runtimeMaxMinutes
      ? Math.min(runtimeMaxMinutes, presets.maxRuntimeMinutes)
      : presets.maxRuntimeMinutes;
  }

  let similarToQuery: string | null = null;
  const simMatch = prompt.match(
    /(?:similar to|like|in the style of|reminds? (?:me )?of|such as)\s+([A-Z][\w:'’.\- ]{2,60}?)(?:[.,;]|$| but | with | that | which | and )/
  );
  if (simMatch) similarToQuery = simMatch[1].trim();

  return {
    genreIds,
    genreNames: [...matchedGenreNames],
    runtimeMaxMinutes,
    runtimeMinMinutes,
    minRating10,
    similarToQuery,
    onlyWatchlist: presets?.onlyWatchlist ?? false,
    onlyStreaming: presets?.onlyStreaming ?? false,
    // R is allowed by default — the UI's "PG-13 and below" toggle opts INTO
    // the stricter cap, rather than opting into R.
    allowR: presets?.allowR ?? true,
  };
}

export type PromptRecommendation = {
  parsed: ParsedPrompt;
  similarToMovie: { id: number; title: string } | null;
  results: TmdbMovieSummary[];
  relaxed: boolean;
};

type Stage = "full" | "dropRating" | "genreOnly" | "popularOnly";

// The user's watchlist, in the fields the local Movie cache actually has —
// used as the candidate pool instead of TMDB discover when "on watchlist" is
// checked. Empty (no query at all) when the filter isn't in use.
async function getWatchlistCandidates(userId: string | undefined) {
  if (!userId) return [];
  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    select: {
      movie: {
        select: {
          tmdbId: true,
          title: true,
          overview: true,
          posterPath: true,
          backdropPath: true,
          releaseDate: true,
          runtime: true,
          genres: true,
          voteAverage: true,
          popularity: true,
        },
      },
    },
  });
  return items.map((i) => i.movie);
}

type WatchlistCandidate = Awaited<ReturnType<typeof getWatchlistCandidates>>[number];

const RESULT_LIMIT = 10;

export async function getPromptRecommendations(
  userId: string | undefined,
  prompt: string,
  presets?: PromptPresets
): Promise<PromptRecommendation> {
  const onlyWatchlist = presets?.onlyWatchlist ?? false;
  const onlyStreaming = presets?.onlyStreaming ?? false;
  const excludeIds = new Set(presets?.excludeIds ?? []);
  // A hard content-rating ceiling, same treatment as onlyWatchlist/
  // onlyStreaming below — always applied, never relaxed away by the
  // fallback stages, since it's a content-appropriateness choice rather
  // than a "loosen this if results are scarce" preference like genre/
  // runtime/rating.
  const maxCertification = (presets?.allowR ?? true) ? "R" : "PG-13";

  const [parsed, watchedIds, genreCatalog, watchlistCandidates, userProviderIds, ownedTmdbIds] =
    await Promise.all([
      parsePrompt(prompt, presets),
      getWatchedTmdbIds(userId),
      getGenres(),
      onlyWatchlist ? getWatchlistCandidates(userId) : Promise.resolve<WatchlistCandidate[]>([]),
      onlyStreaming ? getUserProviderIds(userId) : Promise.resolve(new Set<number>()),
      onlyStreaming ? getUserOwnedTmdbIds(userId) : Promise.resolve(new Set<number>()),
    ]);

  const genreIdToName = new Map(genreCatalog.genres.map((g) => [g.id, g.name]));

  let similarToMovie: { id: number; title: string } | null = null;
  let similarPool: TmdbMovieSummary[] = [];
  let effectiveGenreIds = parsed.genreIds;

  if (parsed.similarToQuery) {
    const searchResult = await searchMovies(parsed.similarToQuery).catch(() => null);
    const top = searchResult?.results[0];
    if (top) {
      similarToMovie = { id: top.id, title: top.title };
      const similar = await getSimilarMovies(top.id).catch(() => ({ results: [] }));
      similarPool = similar.results;
      if (effectiveGenreIds.length === 0 && top.genre_ids) {
        effectiveGenreIds = top.genre_ids.slice(0, 2);
      }
    }
  }

  const effectiveGenreNames = new Set(
    effectiveGenreIds.map((id) => genreIdToName.get(id)).filter((n): n is string => !!n)
  );

  // A repeat click (same criteria, excludeIds set) needs a real shot at
  // fresh candidates beyond whatever page 1 already showed — pull a second
  // page too in that case rather than just hoping page 1 had overflow.
  //
  // "popularOnly" used to fall back to the plain /movie/popular endpoint,
  // but that has no certification filter — switched to the same discover
  // call with genre/rating dropped instead (functionally the same "just
  // popular movies" result), so the content-rating cap survives even the
  // loosest fallback stage.
  //
  // Runtime is a hard cap, same reasoning as content rating — "under 2h"
  // means under 2h, not "under 2h unless that leaves too few results." It's
  // passed at every stage below, never dropped the way genre/rating are.
  async function runDiscover(stage: Stage): Promise<TmdbMovieSummary[]> {
    const pages = excludeIds.size > 0 ? [1, 2] : [1];
    const results = await Promise.all(
      pages.map((page) =>
        discoverMovies({
          genreIds: stage === "popularOnly" ? undefined : effectiveGenreIds,
          minVoteAverage: stage === "full" ? parsed.minRating10 ?? undefined : undefined,
          minRuntime: parsed.runtimeMinMinutes ?? undefined,
          maxRuntime: parsed.runtimeMaxMinutes ?? undefined,
          certificationCountry: "US",
          maxCertification,
          page,
        })
      )
    );
    return results.flatMap((r) => r.results);
  }

  // Mirrors runDiscover's stages, but filtered client-side against the
  // watchlist cache instead of queried from TMDB — "on watchlist" is a hard
  // constraint on the candidate pool itself, never relaxed away like genre/
  // rating are, so even the loosest stage stays watchlist-only. Runtime is
  // also a hard cap here (same reasoning as runDiscover above) and, unlike
  // content rating, the cache does have it, so it applies at every stage.
  // Note: the local Movie cache doesn't store a content rating (TMDB only
  // exposes that via a separate per-movie release_dates call, not on the
  // fields already cached for every movie), so maxCertification isn't
  // applied here — a watchlisted movie is treated as already the user's
  // own choice regardless of rating.
  function runWatchlistPool(stage: Stage): TmdbMovieSummary[] {
    return watchlistCandidates
      .filter((m) => {
        if (stage !== "popularOnly" && effectiveGenreNames.size > 0) {
          const movieGenres = parseGenres(m.genres);
          if (!movieGenres.some((g) => effectiveGenreNames.has(g))) return false;
        }
        if (parsed.runtimeMaxMinutes != null && (m.runtime == null || m.runtime > parsed.runtimeMaxMinutes)) {
          return false;
        }
        if (parsed.runtimeMinMinutes != null && (m.runtime == null || m.runtime < parsed.runtimeMinMinutes)) {
          return false;
        }
        if (stage === "full" && parsed.minRating10 != null) {
          if (m.voteAverage == null || m.voteAverage < parsed.minRating10) return false;
        }
        return true;
      })
      .map((m) => ({
        id: m.tmdbId,
        title: m.title,
        overview: m.overview ?? "",
        poster_path: m.posterPath,
        backdrop_path: m.backdropPath,
        release_date: m.releaseDate ?? "",
        vote_average: m.voteAverage ?? 0,
        popularity: m.popularity ?? undefined,
      }));
  }

  const RUNTIME_CHECK_CONCURRENCY = 8;

  // TMDB's own with_runtime.gte/lte filter on /discover is unreliable — it
  // lets movies outside the requested range through even with the param set
  // correctly (confirmed directly against the API: a 90-minute cap still
  // returned a 103-minute movie). /discover also doesn't return runtime at
  // all, so the only way to actually enforce the cap is to check each
  // candidate's real runtime via ensureMovieCached (same helper used
  // whenever a movie is rated/watchlisted elsewhere in the app — this also
  // warms the local cache for next time). Unknown runtime (a lookup failure)
  // excludes the movie rather than risk violating a cap the user asked for.
  // Not needed for the watchlist pool — runWatchlistPool already checks
  // real runtime from that same local cache directly.
  async function verifyRuntime(movies: TmdbMovieSummary[]): Promise<TmdbMovieSummary[]> {
    if (parsed.runtimeMaxMinutes == null && parsed.runtimeMinMinutes == null) return movies;

    const kept: TmdbMovieSummary[] = [];
    for (let i = 0; i < movies.length; i += RUNTIME_CHECK_CONCURRENCY) {
      const batch = movies.slice(i, i + RUNTIME_CHECK_CONCURRENCY);
      const cached = await Promise.all(batch.map((m) => ensureMovieCached(m.id).catch(() => null)));
      batch.forEach((movie, idx) => {
        const runtime = cached[idx]?.runtime;
        if (runtime == null) return;
        if (parsed.runtimeMaxMinutes != null && runtime > parsed.runtimeMaxMinutes) return;
        if (parsed.runtimeMinMinutes != null && runtime < parsed.runtimeMinMinutes) return;
        kept.push(movie);
      });
    }
    return kept;
  }

  async function buildFinal(pool: TmdbMovieSummary[], skipExclude: boolean) {
    const merged = new Map<number, TmdbMovieSummary>();
    // The "similar to X" pool comes from TMDB's general similar-movies
    // endpoint, not the user's watchlist — folding it in would defeat the
    // point of an explicit "on watchlist" filter, so it's excluded there.
    const sources = onlyWatchlist ? [pool] : [pool, similarPool];
    for (const movie of sources.flat()) {
      if (watchedIds.has(movie.id)) continue;
      if (!skipExclude && excludeIds.has(movie.id)) continue;
      merged.set(movie.id, movie);
    }
    let sorted = [...merged.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    if (!onlyWatchlist) sorted = await verifyRuntime(sorted);
    // Same reasoning as "on watchlist" above: an explicit "on your services"
    // filter is a hard constraint, applied after every stage and never
    // relaxed away, whatever the candidate pool's source.
    return onlyStreaming ? filterMoviesByStreaming(sorted, userProviderIds, ownedTmdbIds) : sorted;
  }

  async function runStage(stage: Stage, skipExclude: boolean) {
    return buildFinal(onlyWatchlist ? runWatchlistPool(stage) : await runDiscover(stage), skipExclude);
  }

  async function runAllStages(skipExclude: boolean) {
    let relaxed = false;
    let pool = await runStage("full", skipExclude);

    if (
      pool.length < RESULT_LIMIT &&
      (parsed.minRating10 || parsed.runtimeMaxMinutes || parsed.runtimeMinMinutes)
    ) {
      relaxed = true;
      pool = await runStage("dropRating", skipExclude);
    }
    if (pool.length < RESULT_LIMIT && effectiveGenreIds.length > 0) {
      relaxed = true;
      pool = await runStage("genreOnly", skipExclude);
    }
    if (pool.length < RESULT_LIMIT) {
      relaxed = true;
      pool = await runStage("popularOnly", skipExclude);
    }
    return { pool, relaxed };
  }

  let { pool, relaxed } = await runAllStages(false);

  // Excluding the previously-shown set left nothing at all (a narrow filter
  // fully exhausted) — a repeat click should never land on a bare "nothing
  // found" screen, so fall back to the same set rather than an empty one.
  if (pool.length === 0 && excludeIds.size > 0) {
    ({ pool, relaxed } = await runAllStages(true));
  }

  return { parsed, similarToMovie, results: pool.slice(0, RESULT_LIMIT), relaxed };
}
