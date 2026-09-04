import { prisma } from "@/lib/prisma";
import { ensureMovieCached, getUserWatchlistedTmdbIds, parseGenres } from "@/lib/movies";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { filterMoviesByStreaming, getUserOwnedTmdbIds, getUserProviderIds } from "@/lib/streaming";
import {
  discoverMovies,
  getGenres,
  getSimilarMovies,
  searchMovies,
  type TmdbMovieSummary,
} from "@/lib/tmdb";
import { parsePrompt, type ParsedPrompt, type PromptPresets } from "@/lib/parsePrompt";

export { parsePrompt, type ParsedPrompt, type PromptPresets };

export type PromptRecommendation = {
  parsed: ParsedPrompt;
  similarToMovie: { id: number; title: string } | null;
  results: TmdbMovieSummary[];
  relaxed: boolean;
};

// Only 3 stages, not 4: nothing besides rating and genre is ever relaxed
// (runtime/certification are hard caps applied at every stage — see below),
// so "drop the rating cap, keep genre" is a single stage, not two identical
// ones. A prior version had a separate "dropRating" stage before "genreOnly"
// that queried TMDB with the exact same params (genre kept, rating already
// dropped by then) — a wasted duplicate API call on every relaxation.
type Stage = "full" | "genreOnly" | "popularOnly";

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
  // Mutually exclusive with onlyWatchlist in the UI (can't ask for "only
  // watchlist" and "never watchlist" at once) — not enforced here, since
  // that's a UI-level chip concern, not something this function needs an
  // opinion on.
  const excludeWatchlist = presets?.excludeWatchlist ?? false;
  const onlyStreaming = presets?.onlyStreaming ?? false;
  const excludeIds = new Set(presets?.excludeIds ?? []);
  // A hard content-rating ceiling, same treatment as onlyWatchlist/
  // onlyStreaming below — always applied, never relaxed away by the
  // fallback stages, since it's a content-appropriateness choice rather
  // than a "loosen this if results are scarce" preference like genre/
  // runtime/rating.
  const maxCertification = (presets?.allowR ?? true) ? "R" : "PG-13";

  const [watchedIds, genreCatalog, watchlistCandidates, userProviderIds, ownedTmdbIds, watchlistedTmdbIds] =
    await Promise.all([
      getWatchedTmdbIds(userId),
      getGenres(),
      onlyWatchlist ? getWatchlistCandidates(userId) : Promise.resolve<WatchlistCandidate[]>([]),
      onlyStreaming ? getUserProviderIds(userId) : Promise.resolve(new Set<number>()),
      onlyStreaming ? getUserOwnedTmdbIds(userId) : Promise.resolve(new Set<number>()),
      excludeWatchlist ? getUserWatchlistedTmdbIds(userId) : Promise.resolve(new Set<number>()),
    ]);

  // Parsed once genres are in hand rather than fetching its own copy — the
  // genre catalog is already being fetched above for the same request.
  const parsed = await parsePrompt(prompt, presets, genreCatalog.genres);

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
      if (excludeWatchlist && watchlistedTmdbIds.has(movie.id)) continue;
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
