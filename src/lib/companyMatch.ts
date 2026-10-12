import type { TmdbCompany } from "@/lib/tmdb";

// Company search's top hit isn't always the real studio — "Universal
// Pictures" returns a logo-less duplicate record first, which rendered as a
// bare "U" tile. Prefer an exact-name match that has a logo, then any exact
// match, then the top hit.
export function pickCompany(
  name: string,
  results: TmdbCompany[]
): TmdbCompany | undefined {
  const exact = results.filter((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  return exact.find((c) => c.logo_path) ?? exact[0] ?? results[0];
}
