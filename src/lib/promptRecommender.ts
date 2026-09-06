import { prisma } from "@/lib/prisma";
import {
  ensureMovieCached,
  getUserWatchlistedTmdbIds,
  isMovieCacheStale,
  parseGenres,
  refreshStaleMovieCache,
} from "@/lib/movies";
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
import { MIN_RECOMMENDABLE_RUNTIME_MINUTES } from "@/lib/runtimeFilter";
import { fisherYatesShuffle } from "@/lib/shuffle";

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
const WATCHLIST_CANDIDATE_SELECT = {
  tmdbId: true,
  title: true,
  overview: true,
  posterPath: true,
  backdropPath: true,
  releaseDate: true,
  runtime: true,
  certification: true,
  genres: true,
  voteAverage: true,
  popularity: true,
  cachedAt: true,
} as const;

async function getWatchlistCandidates(userId: string | undefined) {
  if (!userId) return [];
  const read = async () =>
    (
      await prisma.watchlistItem.findMany({
        where: { userId },
        select: { movie: { select: WATCHLIST_CANDIDATE_SELECT } },
      })
    ).map((i) => i.movie);

  const candidates = await read();

  // This pool reads certification out of the local cache directly, so unlike
  // the discover/similar pools (which go through ensureMovieCached in
  // verifyRuntime and heal as a side effect) it has to refresh stale rows
  // itself. Without this, a movie cached before the certification column
  // existed reads as unrated and gets dropped by the PG-13 cap forever.
  // Bounded by one user's watchlist, and only re-reads when something was
  // actually stale.
  const stale = candidates.filter((m) => isMovieCacheStale(m.cachedAt));
  if (stale.length === 0) return candidates;

  await refreshStaleMovieCache(stale.map((m) => m.tmdbId));
  return read();
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
  const allowR = presets?.allowR ?? true;
  const maxCertification = allowR ? "R" : "PG-13";

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

  // The app-wide "nothing under 45 minutes" floor (see runtimeFilter.ts),
  // combined with whatever longer minimum the user themselves asked for —
  // this is never looser than the global floor, only ever stricter.
  const effectiveMinRuntime = Math.max(MIN_RECOMMENDABLE_RUNTIME_MINUTES, parsed.runtimeMinMinutes ?? 0);

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

  // How many of TMDB's own (popularity/rating-sorted) discover pages count
  // as "the pool" to draw from — deep enough to stay well within genuinely
  // relevant matches, shallow enough that everything in it is still a
  // reasonable recommendation.
  const DISCOVER_POOL_DEPTH_PAGES = 5;

  // A fixed page (or fixed pair of pages) for a given set of filters is
  // exactly why the same handful of movies kept coming back in the same
  // order for the same criteria, forever — even in a brand new session,
  // since nothing about which page got fetched ever varied. Picking a
  // random sample of pages out of the pool depth means two calls with
  // identical filters draw from genuinely different candidates, not just a
  // reshuffled copy of the same fixed set.
  function randomPageSample(count: number): number[] {
    const available = Array.from({ length: DISCOVER_POOL_DEPTH_PAGES }, (_, i) => i + 1);
    return fisherYatesShuffle(available).slice(0, count);
  }

  // A repeat click (same criteria, excludeIds set) needs a real shot at
  // fresh candidates beyond whatever page(s) already showed — sample one
  // extra page in that case rather than just hoping there was overflow.
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
    const pages = randomPageSample(excludeIds.size > 0 ? 3 : 2);
    const results = await Promise.all(
      pages.map((page) =>
        discoverMovies({
          genreIds: stage === "popularOnly" ? undefined : effectiveGenreIds,
          minVoteAverage: stage === "full" ? parsed.minRating10 ?? undefined : undefined,
          minRuntime: effectiveMinRuntime,
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
  // rating are, so even the loosest stage stays watchlist-only. Runtime and
  // certification are hard caps here too (same reasoning as runDiscover
  // above), both checked against the local Movie cache directly —
  // getWatchlistCandidates selects both fields and has already refreshed any
  // row too old to have them — rather than needing a separate
  // ensureMovieCached pass the way the non-watchlist pools do below.
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
        // Always enforced, not just when the user asked for a minimum — see
        // effectiveMinRuntime above.
        if (m.runtime == null || m.runtime < effectiveMinRuntime) {
          return false;
        }
        if (!passesCertificationCap(m.certification)) return false;
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

  const CERTIFICATION_ORDER = ["G", "PG", "PG-13", "R", "NC-17"];
  const maxCertificationRank = CERTIFICATION_ORDER.indexOf(maxCertification);

  // Only the discover-sourced pool ever gets a certification check from
  // TMDB itself (runDiscover passes certification_country/certification.lte
  // — verified reliable there, unlike its runtime filter). The "similar to
  // X" pool comes from /movie/{id}/recommendations, which has no
  // certification param at all, so without this it bypassed the cap
  // entirely — an R-rated "similar to John Wick" result could (and did)
  // slip through even with "PG-13 and below" checked. Checking it here
  // instead, against everything merged into buildFinal, closes that gap and
  // doesn't cost anything extra: every candidate already goes through
  // ensureMovieCached for the runtime check below.
  //
  // Unknown certification (TMDB has no US release_dates entry for it) is
  // let through when R-and-below is the active cap — that's the default,
  // loose state, and TMDB's own discover results already treat unknown the
  // same way — but excluded outright once the user has actively restricted
  // to PG-13-and-below, same reasoning as an unknown runtime: never risk
  // violating a cap the user explicitly turned on.
  function passesCertificationCap(certification: string | null): boolean {
    if (certification == null) return allowR;
    const rank = CERTIFICATION_ORDER.indexOf(certification);
    return rank === -1 || rank <= maxCertificationRank;
  }

  // TMDB's own with_runtime.gte/lte filter on /discover is unreliable — it
  // lets movies outside the requested range through even with the param set
  // correctly (confirmed directly against the API: a 90-minute cap still
  // returned a 103-minute movie). /discover also doesn't return runtime at
  // all, so the only way to actually enforce the cap is to check each
  // candidate's real runtime via ensureMovieCached (same helper used
  // whenever a movie is rated/watchlisted elsewhere in the app — this also
  // warms the local cache for next time). Unknown runtime (a lookup failure)
  // excludes the movie rather than risk violating the app-wide 45-minute
  // floor or a cap the user asked for. Always runs now — even with no
  // user-specified runtime filter at all, the 45-minute floor (see
  // effectiveMinRuntime above) still has to be checked. Not needed for the
  // watchlist pool — runWatchlistPool already checks both runtime and
  // certification from that same local cache directly.
  async function verifyRuntime(movies: TmdbMovieSummary[]): Promise<TmdbMovieSummary[]> {
    const kept: TmdbMovieSummary[] = [];
    for (let i = 0; i < movies.length; i += RUNTIME_CHECK_CONCURRENCY) {
      const batch = movies.slice(i, i + RUNTIME_CHECK_CONCURRENCY);
      const cached = await Promise.all(batch.map((m) => ensureMovieCached(m.id).catch(() => null)));
      batch.forEach((movie, idx) => {
        const runtime = cached[idx]?.runtime;
        if (runtime == null) return;
        if (parsed.runtimeMaxMinutes != null && runtime > parsed.runtimeMaxMinutes) return;
        if (runtime < effectiveMinRuntime) return;
        if (!passesCertificationCap(cached[idx]?.certification ?? null)) return;
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
    let candidates = [...merged.values()];
    if (!onlyWatchlist) candidates = await verifyRuntime(candidates);
    // Same reasoning as "on watchlist" above: an explicit "on your services"
    // filter is a hard constraint, applied after every stage and never
    // relaxed away, whatever the candidate pool's source.
    const filtered = onlyStreaming
      ? await filterMoviesByStreaming(candidates, userProviderIds, ownedTmdbIds)
      : candidates;
    // Shuffled rather than sorted by popularity. Every movie left in the
    // pool already passed every relevance filter (genre/rating/runtime/
    // certification/availability) — there's no "best match" left to rank,
    // so sorting by popularity just meant the same handful of most-popular
    // titles came back in the same order for the same filters, forever,
    // even in a brand new session. Shuffling (and then slicing to
    // RESULT_LIMIT afterward) means both the order AND which subset of the
    // pool gets shown varies from click to click.
    return fisherYatesShuffle(filtered);
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
