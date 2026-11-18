import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseTmdbId } from "@/lib/movieRoute";
import { getMovieDetails, pickTrailer } from "@/lib/tmdb";
import { getWatchAvailability } from "@/lib/streaming";

// What the Discover spotlight ("Pick one for me", or "Tonight" on a card)
// shows beyond what the card already has: runtime, tagline, trailer, and
// where it streams with TMDB's link to watch it.
export async function GET(_request: Request, context: { params: Promise<{ tmdbId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { tmdbId } = await context.params;
  const id = parseTmdbId(tmdbId);
  if (id == null) return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });

  try {
    const [details, availability] = await Promise.all([getMovieDetails(id), getWatchAvailability(id)]);
    const director = details.credits?.crew.find((c) => c.job === "Director")?.name ?? null;
    return NextResponse.json({
      runtime: details.runtime,
      tagline: details.tagline || null,
      overview: details.overview,
      genres: details.genres.map((g) => g.name),
      director,
      trailerKey: pickTrailer(details)?.key ?? null,
      watchLink: availability.link ?? null,
      streaming: (availability.flatrate ?? []).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the movie database. Try again in a moment." },
      { status: 502 }
    );
  }
}
