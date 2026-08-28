import {
  getPopularPeople,
  searchCompanies,
  searchPeople,
  type TmdbCompany,
  type TmdbPerson,
} from "@/lib/tmdb";

const POPULAR_PEOPLE_PAGES = 4;
const ROW_SIZE = 15;

// TMDB's overall people-popularity ranking is dominated by actors — even
// well-known directors barely surface in it (a handful per page at best),
// and cinematographers/studios don't get ranked at all. So those rows are
// built from a curated name list resolved through search instead of
// filtered out of /person/popular.
const FEATURED_DIRECTORS = [
  "Christopher Nolan",
  "Steven Spielberg",
  "Martin Scorsese",
  "Quentin Tarantino",
  "Denis Villeneuve",
  "Greta Gerwig",
  "Jordan Peele",
  "Wes Anderson",
  "Guillermo del Toro",
  "James Cameron",
  "Ridley Scott",
  "Bong Joon Ho",
  "Sofia Coppola",
  "Ryan Coogler",
  "Taika Waititi",
];

const FEATURED_CINEMATOGRAPHERS = [
  "Roger Deakins",
  "Emmanuel Lubezki",
  "Hoyte van Hoytema",
  "Janusz Kamiński",
  "Robert Richardson",
  "Rachel Morrison",
  "Bradford Young",
  "Linus Sandgren",
  "Greig Fraser",
  "Matthew Libatique",
  "Robert Elswit",
  "Dariusz Wolski",
];

const FEATURED_STUDIOS = [
  "Warner Bros. Pictures",
  "Universal Pictures",
  "Walt Disney Pictures",
  "Paramount Pictures",
  "Sony Pictures",
  "Marvel Studios",
  "Columbia Pictures",
  "Legendary Pictures",
  "Lionsgate",
  "A24",
  "20th Century Studios",
  "DreamWorks Pictures",
  "Pixar",
  "New Line Cinema",
  "Focus Features",
];

async function resolveByName<T>(
  names: string[],
  search: (name: string) => Promise<{ results: T[] }>
): Promise<T[]> {
  const found: (T | undefined)[] = await Promise.all(
    names.map((name) => search(name).then((r) => r.results[0]).catch(() => undefined))
  );
  return found.filter((x): x is T => x != null);
}

export async function getBrowseRows() {
  const [peoplePages, directors, cinematographers, studios] = await Promise.all([
    Promise.all(
      Array.from({ length: POPULAR_PEOPLE_PAGES }, (_, i) => getPopularPeople(i + 1))
    ),
    resolveByName(FEATURED_DIRECTORS, searchPeople),
    resolveByName(FEATURED_CINEMATOGRAPHERS, searchPeople),
    resolveByName(FEATURED_STUDIOS, searchCompanies),
  ]);

  const allPeople = dedupeById(peoplePages.flatMap((p) => p.results));

  const actors = allPeople
    .filter((p) => p.known_for_department === "Acting")
    .slice(0, ROW_SIZE);

  return {
    directors: directors.slice(0, ROW_SIZE),
    actors,
    cinematographers: cinematographers.slice(0, ROW_SIZE),
    studios: studios.slice(0, ROW_SIZE),
  };
}

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Map<number, T>();
  for (const item of items) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return [...seen.values()];
}

export type { TmdbPerson, TmdbCompany };
