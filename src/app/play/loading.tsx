// Shown while today's puzzle is prepared. Same two-column shape as the game.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading today's puzzle">
      <div className="skeleton mb-2 h-4 w-28" />
      <div className="skeleton mb-8 h-10 w-72" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-12">
        <div className="skeleton mx-auto aspect-[2/3] w-full max-w-[260px] lg:max-w-none" />
        <div className="space-y-2">
          <div className="skeleton mb-3 h-6 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
