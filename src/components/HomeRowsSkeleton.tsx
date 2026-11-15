// Shown while HomeMovieRows (the TMDB-heavy part of the homepage) is still
// resolving, so the page shell above it doesn't sit on a blank screen in
// the meantime. Shape mirrors MovieRow, captions included, so the page
// doesn't jump when the real rows replace it.
export function HomeRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading films">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row}>
          <div className="skeleton mb-4 h-6 w-44" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="row-card">
                <div className="skeleton aspect-[2/3] w-full" />
                <div className="skeleton mt-2 h-3.5 w-4/5" />
                <div className="skeleton mt-1.5 h-3 w-1/3" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
