// Which of TMDB's "popular people" the Crew page shows as actors. TMDB's
// popularity ranking is worldwide and, much of the time, led by actors from
// Korean, Indian, Thai and Japanese productions this site's audience mostly
// doesn't follow, so the row keeps actors whose best-known films are in
// Western languages and widely seen.
//
// Dependency-free so it can be unit-tested directly (westernActors.test.ts).

export const WESTERN_LANGUAGES = new Set([
  "en", "fr", "es", "it", "de", "pt", "nl", "sv", "da", "no", "fi", "is", "ga", "pl",
]);

// A film with this many TMDB votes is one plenty of people have seen.
// Requiring every title they're known for (TMDB lists up to three) to
// clear it filters out names that are briefly "popular" for a small part
// in one big film. Checked against live data in November 2026: one
// notable film let through a third unknowns, three left only names most
// people would recognise.
const NOTABLE_VOTES = 1000;
const NOTABLE_WORKS = 3;

export type KnownFor = { original_language?: string; vote_count?: number };

export function isWesternActor(person: {
  known_for_department?: string;
  known_for?: KnownFor[];
}): boolean {
  if (person.known_for_department !== "Acting") return false;
  const works = person.known_for ?? [];
  if (works.length === 0) return false;
  const western = works.filter((w) => w.original_language && WESTERN_LANGUAGES.has(w.original_language));
  if (western.length * 2 < works.length) return false; // most of what they're known for
  const notable = western.filter((w) => (w.vote_count ?? 0) >= NOTABLE_VOTES).length;
  return notable >= Math.min(NOTABLE_WORKS, works.length);
}
