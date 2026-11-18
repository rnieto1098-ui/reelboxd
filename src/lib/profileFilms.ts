// The pure half of the profile Films page (src/app/profile/[username]/films):
// reading its URL, building links back to it, star formatting and the
// in-memory sort used for "Not rated". No imports, so it's unit-testable
// directly (see profileFilms.test.ts).

export type SortDir = "asc" | "desc";

export const FILM_SORTS = {
  rated: { label: "Date rated" },
  rating: { label: "Rating" },
  release: { label: "Release date" },
  title: { label: "Title" },
} as const;
export type FilmSortKey = keyof typeof FILM_SORTS;

// Highest first, the order the filter chips appear in.
export const STAR_VALUES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

export type FilmsParams = {
  sort: FilmSortKey;
  dir: SortDir;
  // An exact star rating, "unrated" for films seen without one, or null for all rated films.
  stars: number | "unrated" | null;
  page: number;
};

export type FilmRow = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  score: number | null;
  // When it was rated, or for an unrated film when it was seen.
  at: Date;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFilmsParams(raw: RawParams): FilmsParams {
  const sortRaw = first(raw.sort);
  const sort: FilmSortKey = sortRaw && sortRaw in FILM_SORTS ? (sortRaw as FilmSortKey) : "rated";
  const dirRaw = first(raw.dir);
  // Titles read naturally A→Z; everything else newest/highest first.
  const dir: SortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : sort === "title" ? "asc" : "desc";
  const starsRaw = first(raw.stars);
  const starsNum = Number(starsRaw);
  const stars =
    starsRaw === "unrated" ? "unrated" : STAR_VALUES.includes(starsNum) ? starsNum : null;
  const pageNum = Number(first(raw.page));
  return { sort, dir, stars, page: Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1 };
}

export function filmsHref(username: string, p: FilmsParams): string {
  const q = new URLSearchParams();
  if (p.sort !== "rated") q.set("sort", p.sort);
  const defaultDir: SortDir = p.sort === "title" ? "asc" : "desc";
  if (p.dir !== defaultDir) q.set("dir", p.dir);
  if (p.stars != null) q.set("stars", String(p.stars));
  if (p.page > 1) q.set("page", String(p.page));
  const qs = q.toString();
  return `/profile/${encodeURIComponent(username)}/films${qs ? `?${qs}` : ""}`;
}

/** 4.5 → "★★★★½". */
export function formatStars(score: number): string {
  const whole = Math.floor(score);
  return "★".repeat(whole) + (score - whole >= 0.5 ? "½" : "");
}

/** The same orderings the database applies to rated films, for in-memory lists. */
export function sortFilms(rows: FilmRow[], sort: FilmSortKey, dir: SortDir): FilmRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const key = (r: FilmRow): number | string =>
    sort === "title"
      ? r.title.toLocaleLowerCase()
      : sort === "release"
        ? (r.releaseDate ?? "")
        : sort === "rating"
          ? (r.score ?? -1)
          : r.at.getTime();
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    return b.at.getTime() - a.at.getTime();
  });
}
