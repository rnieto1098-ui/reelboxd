// Shown while HomeMovieRows (the TMDB-heavy part of the homepage) is still
// resolving, so the page shell above it doesn't sit on a blank screen in
// the meantime. Shape mirrors MovieRow: a title-sized bar over a row of
// poster-sized placeholders.
export function HomeRowsSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row}>
          <div className="mb-3 h-6 w-40 animate-pulse rounded bg-surface" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-24 flex-shrink-0 animate-pulse rounded-md bg-surface sm:w-28"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
