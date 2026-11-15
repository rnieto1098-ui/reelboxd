import { NextResponse } from "next/server";
import { ensureMovieCached } from "@/lib/movies";

type CachedMovie = Awaited<ReturnType<typeof ensureMovieCached>>;

/** A TMDB id from a URL segment or request body, or null if it isn't one. */
export function parseTmdbId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 && id < 2 ** 31 ? id : null;
}

/**
 * The first step of every route that acts on a film: make sure it is in the
 * local Movie cache, fetching it from TMDB the first time anyone touches it.
 *
 * Returns either the movie or a ready-made error response. Routes used to
 * call ensureMovieCached(Number(tmdbId)) directly and let anything it threw
 * surface as a bare 500, so "/api/movies/abc/like", a deleted TMDB id and a
 * TMDB outage all looked identical to the client. Here they are a 400, a
 * 404 and a 502 with a message the UI can show.
 */
export async function movieForRoute(
  tmdbId: unknown
): Promise<{ movie: CachedMovie; response?: undefined } | { movie?: undefined; response: NextResponse }> {
  const id = parseTmdbId(tmdbId);
  if (id == null) {
    return { response: NextResponse.json({ error: "Invalid movie id" }, { status: 400 }) };
  }
  try {
    return { movie: await ensureMovieCached(id) };
  } catch (error) {
    // tmdbFetch reports the upstream status in its message: "(404)".
    const notFound = error instanceof Error && /\(404\)/.test(error.message);
    return {
      response: NextResponse.json(
        {
          error: notFound
            ? "That film isn't in the movie database."
            : "Couldn't reach the movie database. Try again in a moment.",
        },
        { status: notFound ? 404 : 502 }
      ),
    };
  }
}
