/**
 * Defensive cleanup for any list of movies about to be rendered as cards.
 * Dependency-free like sortComparator.ts and streamingAvailability.ts so
 * it's directly unit-testable.
 *
 * Guards against two failure modes, both rare but real given these lists
 * come from live third-party data (TMDB), sometimes merged across several
 * pages or endpoints, sometimes concatenated with locally-built stand-ins:
 * a movie with no usable title (an unannounced/withdrawn TMDB entry can
 * carry a blank title), and the same movie appearing twice in one row (two
 * fetched pages overlapping, or two differently-sourced lists combined
 * without an id check). MovieCard already renders a poster-less fallback
 * and hides a missing year gracefully — this catches the case underneath
 * that, where there's nothing worth showing at all.
 */
export function cleanMovieList<T extends { id: number; title: string }>(movies: T[]): T[] {
  const seen = new Set<number>();
  const cleaned: T[] = [];
  for (const movie of movies) {
    if (!movie.title?.trim()) continue;
    if (seen.has(movie.id)) continue;
    seen.add(movie.id);
    cleaned.push(movie);
  }
  return cleaned;
}

/**
 * Whether `genreId` is a movie's most prominent genre, not just one it
 * happens to carry. TMDB returns `genre_ids` in an order that puts the
 * defining genre first — a `with_genres` discover query matches ANY genre
 * a movie has though, which is how an animated family film tagged
 * [Animation, Drama, Family] (Drama a distant afterthought) ends up in a
 * row literally titled "Drama" next to films that are actually about
 * something. This narrows a genre-tagged row down to films where the
 * genre is the point, not a secondary label.
 */
export function isPrimaryGenre(movie: { genre_ids?: number[] }, genreId: number): boolean {
  return movie.genre_ids?.[0] === genreId;
}
