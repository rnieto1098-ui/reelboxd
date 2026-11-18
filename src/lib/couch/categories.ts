// The browse rows in each Couch app beyond your watchlist and picks: new
// arrivals, acclaimed films, hidden gems and a row per genre, each one a
// TMDB discover query limited to that service. Pure (no fetching), so the
// list and its ordering are unit-testable (see couchCategories.test.ts).

import { GENRE_IDS } from "../discover/taste.ts";

export type CategoryQuery = {
  sortBy?: string;
  anyGenreIds?: number[];
  minVoteCount?: number;
  maxVoteCount?: number;
  minVoteAverage?: number;
  releasedAfter?: string;
  releasedBefore?: string;
  maxRuntime?: number;
};

export type Category = { key: string; title: string; query: CategoryQuery };

// Genre rows, in the order they appear when they aren't one of your
// favourites. Some pair up genres that TMDB keeps apart but people browse
// together.
const GENRE_ROWS: { key: string; title: string; ids: number[] }[] = [
  { key: "action", title: "Action & Adventure", ids: [GENRE_IDS.Action, GENRE_IDS.Adventure] },
  { key: "comedy", title: "Comedy", ids: [GENRE_IDS.Comedy] },
  { key: "thriller", title: "Thrillers", ids: [GENRE_IDS.Thriller] },
  { key: "drama", title: "Drama", ids: [GENRE_IDS.Drama] },
  { key: "scifi", title: "Sci-Fi & Fantasy", ids: [GENRE_IDS["Science Fiction"], GENRE_IDS.Fantasy] },
  { key: "horror", title: "Horror", ids: [GENRE_IDS.Horror] },
  { key: "crime", title: "Crime", ids: [GENRE_IDS.Crime] },
  { key: "mystery", title: "Mystery", ids: [GENRE_IDS.Mystery] },
  { key: "romance", title: "Romance", ids: [GENRE_IDS.Romance] },
  { key: "family", title: "Animation & Family", ids: [GENRE_IDS.Animation, GENRE_IDS.Family] },
  { key: "history", title: "War & History", ids: [GENRE_IDS.War, GENRE_IDS.History] },
  { key: "documentary", title: "Documentaries", ids: [GENRE_IDS.Documentary] },
  { key: "western", title: "Westerns", ids: [GENRE_IDS.Western] },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Every category for one service, in display order. Genres the user rates
 * highest (`topGenres`, as names like "Thriller") come first, labelled as
 * theirs; the rest follow in the fixed order above.
 */
export function serviceCategories(serviceName: string, topGenres: string[], now = new Date()): Category[] {
  const yearAgo = new Date(now);
  yearAgo.setFullYear(now.getFullYear() - 1);

  const topIds = topGenres.map((name) => GENRE_IDS[name]).filter((id): id is number => id != null);
  const isTop = (row: (typeof GENRE_ROWS)[number]) => row.ids.some((id) => topIds.includes(id));
  const genreRow = (row: (typeof GENRE_ROWS)[number]): Category => ({
    key: row.key,
    title: row.title,
    query: { anyGenreIds: row.ids, sortBy: "popularity.desc", minVoteCount: 150 },
  });
  // Favourites in the order the user ranks them, not the fixed order.
  const favourites = topIds
    .map((id) => GENRE_ROWS.find((row) => row.ids.includes(id)))
    .filter((row, i, all): row is (typeof GENRE_ROWS)[number] => row != null && all.indexOf(row) === i);

  return [
    {
      key: "new",
      title: `New on ${serviceName}`,
      query: { releasedAfter: isoDate(yearAgo), sortBy: "popularity.desc", minVoteCount: 40 },
    },
    ...favourites.map((row) => ({ ...genreRow(row), key: `top-${row.key}`, title: `${row.title}, your favourite` })),
    {
      key: "acclaimed",
      title: "Critically acclaimed",
      query: { sortBy: "vote_average.desc", minVoteCount: 2000 },
    },
    {
      key: "gems",
      title: "Hidden gems",
      query: { sortBy: "vote_average.desc", minVoteAverage: 7, minVoteCount: 150, maxVoteCount: 1500 },
    },
    ...GENRE_ROWS.filter((row) => !isTop(row)).slice(0, 6).map(genreRow),
    {
      key: "quick",
      title: "Under 100 minutes",
      query: { maxRuntime: 100, sortBy: "popularity.desc", minVoteCount: 300 },
    },
    {
      key: "classics",
      title: "Classics",
      query: { releasedBefore: "1990-01-01", sortBy: "popularity.desc", minVoteCount: 500 },
    },
    ...GENRE_ROWS.filter((row) => !isTop(row)).slice(6).map(genreRow),
  ];
}
