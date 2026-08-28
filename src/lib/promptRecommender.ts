import { getWatchedTmdbIds } from "@/lib/recommendations";
import {
  discoverMovies,
  getGenres,
  getPopularMovies,
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
};

function toMinutes(value: number, unit: string): number {
  return unit.startsWith("h") ? Math.round(value * 60) : Math.round(value);
}

export type PromptPresets = {
  genreNames?: string[];
  maxRuntimeMinutes?: number | null;
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
  };
}

export type PromptRecommendation = {
  parsed: ParsedPrompt;
  similarToMovie: { id: number; title: string } | null;
  results: TmdbMovieSummary[];
  relaxed: boolean;
};

export async function getPromptRecommendations(
  userId: string | undefined,
  prompt: string,
  presets?: PromptPresets
): Promise<PromptRecommendation> {
  const [parsed, watchedIds] = await Promise.all([
    parsePrompt(prompt, presets),
    getWatchedTmdbIds(userId),
  ]);

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

  async function runDiscover(stage: "full" | "dropRating" | "genreOnly" | "popularOnly") {
    if (stage === "popularOnly") {
      const popular = await getPopularMovies();
      return popular.results;
    }
    const page = await discoverMovies({
      genreIds: effectiveGenreIds,
      minVoteAverage: stage === "full" ? parsed.minRating10 ?? undefined : undefined,
      minRuntime: stage === "genreOnly" ? undefined : parsed.runtimeMinMinutes ?? undefined,
      maxRuntime: stage === "genreOnly" ? undefined : parsed.runtimeMaxMinutes ?? undefined,
    });
    return page.results;
  }

  function buildFinal(discoverPool: TmdbMovieSummary[]) {
    const merged = new Map<number, TmdbMovieSummary>();
    for (const movie of [...discoverPool, ...similarPool]) {
      if (!watchedIds.has(movie.id)) merged.set(movie.id, movie);
    }
    return [...merged.values()].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }

  let relaxed = false;
  let pool = buildFinal(await runDiscover("full"));

  if (pool.length < 3 && (parsed.minRating10 || parsed.runtimeMaxMinutes || parsed.runtimeMinMinutes)) {
    relaxed = true;
    pool = buildFinal(await runDiscover("dropRating"));
  }
  if (pool.length < 3 && effectiveGenreIds.length > 0) {
    relaxed = true;
    pool = buildFinal(await runDiscover("genreOnly"));
  }
  if (pool.length < 3) {
    relaxed = true;
    pool = buildFinal(await runDiscover("popularOnly"));
  }

  return { parsed, similarToMovie, results: pool.slice(0, 5), relaxed };
}
