// Placeholder rows while the Discover feed builds (a first visit can take a
// few seconds: every film is checked against your services).
export function DiscoverSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading picks" className="space-y-10">
      <div className="skeleton h-10 w-44" />
      {[0, 1, 2].map((row) => (
        <div key={row}>
          <div className="skeleton mb-4 h-6 w-56" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="row-card">
                <div className="skeleton aspect-[2/3] w-full" />
                <div className="skeleton mt-2 h-3.5 w-4/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
