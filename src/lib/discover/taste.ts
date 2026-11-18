// The pure half of Discover: genre tables, moods, the taste profile and how
// a film is scored against it. No database or network access here, so it
// can be unit-tested directly (see taste.test.ts); lib/discover/feed.ts does
// the fetching.

// TMDB's movie genre ids. They have been stable for years, and hardcoding
// them saves a genre-list request on every Discover load.
export const GENRE_IDS: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  "TV Movie": 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

export const GENRE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(GENRE_IDS).map(([name, id]) => [id, name])
);

/** Genre names as the Movie table stores them ("Drama, Crime") to TMDB ids. */
export function genreIdsFromNames(names: string | null | undefined): number[] {
  if (!names) return [];
  return names
    .split(",")
    .map((n) => GENRE_IDS[n.trim()])
    .filter((id): id is number => id != null);
}

// Genres Discover never builds a row around: TV movies and documentaries
// make odd "because you like" picks, and most people rate few of them.
const NEVER_SEED_GENRES = new Set([GENRE_IDS["TV Movie"], GENRE_IDS.Documentary]);

export type MoodId = "light" | "intense" | "funny" | "mindbending" | "comfort" | "different";

export type Mood = {
  id: MoodId;
  label: string;
  // Any of these (empty = no genre requirement; "different" fills its own).
  include: number[];
  // None of these.
  exclude: number[];
};

const G = GENRE_IDS;

export const MOODS: Mood[] = [
  {
    id: "light",
    label: "Light",
    include: [G.Comedy, G.Animation, G.Family, G.Romance, G.Adventure, G.Fantasy],
    exclude: [G.Horror, G.War, G.Thriller, G.Crime],
  },
  {
    id: "intense",
    label: "Intense",
    include: [G.Thriller, G.Action, G.Crime, G.Horror, G.War],
    exclude: [G.Animation, G.Family],
  },
  { id: "funny", label: "Funny", include: [G.Comedy], exclude: [G.Horror, G.War] },
  {
    id: "mindbending",
    label: "Mind-bending",
    include: [G["Science Fiction"], G.Mystery],
    exclude: [G.Animation, G.Family],
  },
  {
    id: "comfort",
    label: "Comfort",
    include: [G.Comedy, G.Family, G.Animation, G.Romance, G.Adventure],
    exclude: [G.Horror, G.War, G.Thriller],
  },
  { id: "different", label: "Something different", include: [], exclude: [] },
];

export function moodById(id: string | null | undefined): Mood | null {
  return MOODS.find((m) => m.id === id) ?? null;
}

export const RUNTIME_LIMITS = [90, 120] as const;
export type RuntimeLimit = (typeof RUNTIME_LIMITS)[number];

export function parseRuntimeLimit(value: string | null | undefined): RuntimeLimit | null {
  const n = Number(value);
  return (RUNTIME_LIMITS as readonly number[]).includes(n) ? (n as RuntimeLimit) : null;
}

/** One film the user has an opinion on, in the shape the profile needs. */
export type TasteSignal = {
  tmdbId: number;
  genreIds: number[];
  directorId: number | null;
  directorName: string | null;
  castIds: number[];
  castNames: string[];
  // Star rating 0.5–5, or null when the film was logged or marked watched
  // without one.
  score: number | null;
  dismissed: boolean;
  // When the user rated or logged it; newer favourites seed rows first.
  at: number;
  title: string;
};

export type TasteProfile = {
  // Genre id → affinity in [-1, 1]. Missing means no opinion.
  genres: Record<number, number>;
  // Best liked genres first, never including NEVER_SEED_GENRES.
  topGenres: number[];
  people: { id: number; name: string; role: "director" | "cast" }[];
  // Films rated highly enough to build a "Because you loved" row around.
  seeds: { tmdbId: number; title: string; score: number }[];
  // How many films fed the profile; under a handful it's mostly a guess.
  signalCount: number;
};

/**
 * How much one signal pushes its genres up or down. A rating is centred on
 * 3 stars: 5★ is +2, 1★ is -2. A film seen but never rated is a mild
 * positive (people mostly log what they chose to watch). "Not for me" is a
 * firm negative, since it was said about the film's premise outright.
 */
export function signalWeight(signal: Pick<TasteSignal, "score" | "dismissed">): number {
  if (signal.dismissed) return -1.5;
  if (signal.score == null) return 0.5;
  return signal.score - 3;
}

const TOP_DIRECTORS = 2;
const TOP_CAST = 3;
const MAX_SEEDS = 3;

export function buildTasteProfile(signals: TasteSignal[]): TasteProfile {
  const genreSums = new Map<number, number>();
  const directorScores = new Map<number, { name: string; total: number; count: number }>();
  const castScores = new Map<number, { name: string; total: number; count: number }>();

  for (const signal of signals) {
    const weight = signalWeight(signal);
    for (const g of signal.genreIds) genreSums.set(g, (genreSums.get(g) ?? 0) + weight);

    // People only from films the user actually liked: an actor in one film
    // you rated 2★ isn't someone to avoid, just not someone to chase.
    if (signal.dismissed || signal.score == null || signal.score < 4) continue;
    if (signal.directorId != null) {
      const d = directorScores.get(signal.directorId) ?? {
        name: signal.directorName ?? "",
        total: 0,
        count: 0,
      };
      d.total += weight;
      d.count += 1;
      directorScores.set(signal.directorId, d);
    }
    signal.castIds.slice(0, 3).forEach((id, i) => {
      const c = castScores.get(id) ?? { name: signal.castNames[i] ?? "", total: 0, count: 0 };
      c.total += weight;
      c.count += 1;
      castScores.set(id, c);
    });
  }

  const maxAbs = Math.max(1, ...[...genreSums.values()].map(Math.abs));
  const genres: Record<number, number> = {};
  for (const [id, sum] of genreSums) genres[id] = sum / maxAbs;

  const topGenres = Object.entries(genres)
    .map(([id, v]) => [Number(id), v] as const)
    .filter(([id, v]) => v > 0 && !NEVER_SEED_GENRES.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  // Someone has to appear in at least two liked films to count as a person
  // you like; one great film is a film, not a pattern.
  const rankPeople = (
    scores: Map<number, { name: string; total: number; count: number }>,
    count: number,
    role: "director" | "cast"
  ) =>
    [...scores.entries()]
      .filter(([, p]) => p.count >= 2 && p.name)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, count)
      .map(([id, p]) => ({ id, name: p.name, role }));

  const rated = signals.filter((s) => !s.dismissed && s.score != null) as (TasteSignal & {
    score: number;
  })[];
  const byLove = (min: number) =>
    rated
      .filter((s) => s.score >= min)
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, MAX_SEEDS)
      .map((s) => ({ tmdbId: s.tmdbId, title: s.title, score: s.score }));
  const seeds = byLove(4.5).length > 0 ? byLove(4.5) : byLove(4);

  return {
    genres,
    topGenres,
    people: [
      ...rankPeople(directorScores, TOP_DIRECTORS, "director"),
      ...rankPeople(castScores, TOP_CAST, "cast"),
    ],
    seeds,
    signalCount: signals.length,
  };
}

/** The genres "Something different" builds around: ones the user rarely watches. */
export function differentGenres(profile: TasteProfile): { include: number[]; exclude: number[] } {
  const exclude = profile.topGenres.slice(0, 3);
  const candidates = [
    G.Western,
    G.History,
    G.Music,
    G.War,
    G.Animation,
    G.Fantasy,
    G.Mystery,
    G.Romance,
    G.Horror,
    G["Science Fiction"],
    G.Documentary,
    G.Comedy,
  ].filter((id) => !exclude.includes(id));
  // Least explored first: no opinion counts as 0, so untried genres lead.
  const include = candidates
    .sort((a, b) => (profile.genres[a] ?? 0) - (profile.genres[b] ?? 0))
    .slice(0, 4);
  return { include, exclude };
}

export type ScorableFilm = {
  genre_ids?: number[];
  vote_average: number;
  vote_count?: number;
  popularity?: number;
};

/**
 * How good a match a film is, roughly -1.5 to 2. Genre fit leads; how well
 * reviewed it is comes second, so a strong match to your taste still beats
 * a slightly better-reviewed film in a genre you avoid. Popularity is a
 * small tiebreak, scaled down hard so it can't turn the feed into a
 * trending list.
 */
export function scoreFilm(film: ScorableFilm, profile: TasteProfile): number {
  const ids = film.genre_ids ?? [];
  const genreFit =
    ids.length === 0 ? 0 : ids.reduce((sum, id) => sum + (profile.genres[id] ?? 0), 0) / ids.length;
  // A 9.0 from twelve votes says little; trust the average less below ~200.
  const confidence = Math.min(1, (film.vote_count ?? 0) / 200);
  const quality = Math.max(-1, Math.min(1, ((film.vote_average - 6.5) / 2) * confidence));
  const popularity = Math.min(1, Math.log10((film.popularity ?? 0) + 1) / 3);
  return genreFit + 0.6 * quality + 0.15 * popularity;
}

/** The genre to name in "You like Thriller", or null if no genre stands out. */
export function reasonGenre(film: ScorableFilm, profile: TasteProfile): string | null {
  let best: number | null = null;
  for (const id of film.genre_ids ?? []) {
    const v = profile.genres[id] ?? 0;
    if (v > 0.25 && (best == null || v > (profile.genres[best] ?? 0))) best = id;
  }
  return best == null ? null : (GENRE_NAMES[best] ?? null);
}

/** Whether a film fits a mood's genre rules (only used for non-discover sources). */
export function fitsGenres(
  genreIds: number[],
  rules: { include: number[]; exclude: number[] }
): boolean {
  if (rules.exclude.some((id) => genreIds.includes(id))) return false;
  if (rules.include.length === 0) return true;
  return rules.include.some((id) => genreIds.includes(id));
}

/**
 * Picks the film "Pick one for me" shows: a weighted draw from the best few
 * rather than always the top one, so pressing it again gives a different
 * film. `random` is injectable for tests.
 */
export function weightedPick<T extends { score: number }>(
  films: T[],
  exclude: Set<T> = new Set(),
  random: () => number = Math.random,
  poolSize = 8
): T | null {
  const pool = films.filter((f) => !exclude.has(f)).slice(0, poolSize);
  if (pool.length === 0) return null;
  const min = Math.min(...pool.map((f) => f.score));
  const weights = pool.map((f) => f.score - min + 0.25);
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
