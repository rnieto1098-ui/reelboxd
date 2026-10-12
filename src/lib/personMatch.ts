// TMDB's /search/person is loose — a movie-title query like "the matrix"
// still returns a page of people with some vague connection. The main search
// bar only shows people whose name actually matches what was typed: every
// query word must start one of the name's words ("nolan", "chris nolan",
// "zoe kravitz" for "Zoë Kravitz").

const DIACRITIC_MARKS = /[̀-ͯ]/g;

function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function nameMatchesQuery(name: string, query: string): boolean {
  const queryWords = words(query);
  if (queryWords.length === 0) return false;
  const nameWords = words(name);
  return queryWords.every((q) => nameWords.some((n) => n.startsWith(q)));
}

export function matchingPeople<T extends { name: string; popularity?: number }>(
  people: T[],
  query: string,
  limit = 12
): T[] {
  return people
    .filter((p) => nameMatchesQuery(p.name, query))
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, limit);
}
