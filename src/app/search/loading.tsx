// Shown while search results load from TMDB (following a result page link,
// or submitting the search field).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Searching">
      <div className="skeleton mb-4 h-9 w-64" />
      <div className="skeleton mb-8 h-12 w-full max-w-2xl rounded-full" />
      <div className="poster-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] w-full" />
            <div className="skeleton mt-2 h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
