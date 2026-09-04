// Split out from promptRecommender.ts (which needs prisma + TMDB fetches)
// so this — pure text parsing, no DB/network dependency now that genres are
// passed in rather than fetched internally — can be unit tested directly.

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
  // Mutually exclusive with onlyWatchlist in the UI (the two chips can't
  // both be selected) — but each is read independently here since this
  // parser has no opinion on that, it just reflects whatever presets said.
  excludeWatchlist: boolean;
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
  excludeWatchlist?: boolean;
  onlyStreaming?: boolean;
  allowR?: boolean;
  // Movie ids to leave out of the results — sent when the user hits
  // "Recommend me something" again without changing any criteria, so a
  // repeat click surfaces a fresh set instead of the same one.
  excludeIds?: number[];
};

export function parsePrompt(
  prompt: string,
  presets: PromptPresets | undefined,
  allGenres: { id: number; name: string }[]
): ParsedPrompt {
  const lower = prompt.toLowerCase();
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
    excludeWatchlist: presets?.excludeWatchlist ?? false,
    onlyStreaming: presets?.onlyStreaming ?? false,
    // R is allowed by default — the UI's "PG-13 and below" toggle opts INTO
    // the stricter cap, rather than opting into R.
    allowR: presets?.allowR ?? true,
  };
}
