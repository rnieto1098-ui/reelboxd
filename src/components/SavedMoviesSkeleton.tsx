// Shown the instant the Watchlist or Rewatch tab is clicked, while
// SavedMoviesPage loads the list and its streaming availability. Without
// it, a click did nothing visible until the whole page had rendered. Shape
// mirrors SavedMoviesPage: title, count line, filter row, poster grid.
export function SavedMoviesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-1 h-8 w-48 animate-pulse rounded bg-surface" />
      <div className="mb-4 mt-2 h-4 w-64 animate-pulse rounded bg-surface" />
      <div className="mb-6 flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-32 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    </div>
  );
}
