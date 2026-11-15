// Shown the moment a poster is clicked, while the film's details load from
// TMDB. Same shape as the real page (hero, activity card, sidebar) so
// nothing jumps when it arrives.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading film">
      <div className="bleed -mt-8 bg-surface">
        <div className="container-page grid grid-cols-[minmax(0,1fr)] items-end gap-6 pb-10 pt-16 sm:gap-10 sm:pt-28 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] lg:pt-36">
          <div className="skeleton mx-auto aspect-[2/3] w-44 sm:w-56 md:mx-0 md:w-full" />
          <div className="flex flex-col items-center gap-4 md:items-start">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-12 w-4/5 max-w-xl" />
            <div className="skeleton h-5 w-64" />
            <div className="mt-2 flex gap-3">
              <div className="skeleton h-12 w-40" />
              <div className="skeleton h-12 w-32" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-4 w-full max-w-3xl" />
          <div className="skeleton h-4 w-5/6 max-w-3xl" />
          <div className="skeleton h-4 w-2/3 max-w-3xl" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-36 w-full" />
          <div className="skeleton h-56 w-full" />
        </div>
      </div>
    </div>
  );
}
