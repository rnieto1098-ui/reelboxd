import {
  getPopularPeople,
  searchCompanies,
  searchPeople,
  type TmdbCompany,
  type TmdbPerson,
} from "@/lib/tmdb";
import { pickCompany } from "@/lib/companyMatch";
import { isWesternActor } from "@/lib/westernActors";

// More pages than the row needs: the Western-actor filter (see
// westernActors.ts) keeps roughly half of each page.
const POPULAR_PEOPLE_PAGES = 8;
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

// The Crew page leads with actors. Popular right now comes from TMDB; these
// two rows are hand-picked so the page always has the faces people expect.
const HOLLYWOOD_GREATS = [
  "Meryl Streep",
  "Denzel Washington",
  "Tom Hanks",
  "Leonardo DiCaprio",
  "Viola Davis",
  "Al Pacino",
  "Cate Blanchett",
  "Robert De Niro",
  "Morgan Freeman",
  "Julia Roberts",
  "Daniel Day-Lewis",
  "Nicole Kidman",
  "Samuel L. Jackson",
  "Sigourney Weaver",
  "Harrison Ford",
];

const RISING_STARS = [
  "Timothée Chalamet",
  "Zendaya",
  "Florence Pugh",
  "Austin Butler",
  "Jenna Ortega",
  "Paul Mescal",
  "Sydney Sweeney",
  "Jacob Elordi",
  "Anya Taylor-Joy",
  "Barry Keoghan",
  "Glen Powell",
  "Margaret Qualley",
  "Mikey Madison",
  "Josh O'Connor",
  "Ayo Edebiri",
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
  search: (name: string) => Promise<{ results: T[] }>,
  pick: (name: string, results: T[]) => T | undefined = (_, results) => results[0]
): Promise<T[]> {
  const found: (T | undefined)[] = await Promise.all(
    names.map((name) =>
      search(name)
        .then((r) => pick(name, r.results))
        .catch(() => undefined)
    )
  );
  return found.filter((x): x is T => x != null);
}


export async function getBrowseRows() {
  const [peoplePages, greats, rising, directors, cinematographers, studios] = await Promise.all([
    Promise.all(
      Array.from({ length: POPULAR_PEOPLE_PAGES }, (_, i) =>
        getPopularPeople(i + 1).catch(() => ({ results: [] as TmdbPerson[], total_pages: 0 }))
      )
    ),
    resolveByName(HOLLYWOOD_GREATS, searchPeople),
    resolveByName(RISING_STARS, searchPeople),
    resolveByName(FEATURED_DIRECTORS, searchPeople),
    resolveByName(FEATURED_CINEMATOGRAPHERS, searchPeople),
    resolveByName(FEATURED_STUDIOS, searchCompanies, pickCompany),
  ]);

  const allPeople = dedupeById(peoplePages.flatMap((p) => p.results));

  const actors = allPeople.filter(isWesternActor).slice(0, ROW_SIZE);
  // Someone popular this week who is also hand-picked below shows once, in
  // the popular row.
  const shownActors = new Set(actors.map((p) => p.id));

  return {
    actors,
    greats: greats.filter((p) => !shownActors.has(p.id)).slice(0, ROW_SIZE),
    rising: rising.filter((p) => !shownActors.has(p.id)).slice(0, ROW_SIZE),
    directors: directors.slice(0, ROW_SIZE),
    cinematographers: cinematographers.slice(0, ROW_SIZE),
    studios: dedupeById(studios).slice(0, ROW_SIZE),
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
