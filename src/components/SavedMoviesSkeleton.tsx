// Shown the instant the Watchlist or Rewatch tab is clicked, while
// SavedMoviesPage loads the list and its streaming availability. Without
// it, a click did nothing visible until the whole page had rendered. Shape
// mirrors SavedMoviesPage: title, count line, filter row, poster grid.
export function SavedMoviesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton mb-1 h-9 w-56" />
      <div className="skeleton mb-5 mt-3 h-4 w-64" />
      <div className="mb-6 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-32" />
        ))}
      </div>
      <div className="poster-grid">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton mt-2 h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
