import { prisma } from "@/lib/prisma";
import { getMovieDetails } from "@/lib/tmdb";

// Movie.genres is cached as a comma-separated string (see the `create` call
// below); this reverses that back into a clean array wherever it's read.
export function parseGenres(genres: string | null): string[] {
  return genres?.split(", ").filter(Boolean) ?? [];
}

// Ratings/watchlist items store a foreign key to our local Movie
// cache rather than the raw TMDB id, so a movie has to be pulled from TMDB
// and cached locally the first time anyone interacts with it.
export async function ensureMovieCached(tmdbId: number) {
  const existing = await prisma.movie.findUnique({ where: { tmdbId } });
  if (existing) return existing;

  const details = await getMovieDetails(tmdbId);
  const director = details.credits?.crew.find((c) => c.job === "Director");
  // TMDB returns cast already in billing order; top 5 is plenty of signal
  // for "movies with people you seem to like" without over-weighting a film
  // that just happens to have a huge ensemble.
  const topCastIds = details.credits?.cast.slice(0, 5).map((c) => c.id).join(",") ?? null;

  return prisma.movie.create({
    data: {
      tmdbId: details.id,
      title: details.title,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate: details.release_date,
      runtime: details.runtime,
      genres: details.genres.map((g) => g.name).join(", "),
      voteAverage: details.vote_average,
      popularity: details.popularity ?? null,
      directorId: director?.id ?? null,
      topCastIds: topCastIds || null,
    },
  });
}
