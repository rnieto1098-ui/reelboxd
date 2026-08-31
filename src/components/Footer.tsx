// TMDB's API terms require attributing them as the data source on any
// public page using their data — text attribution (no logo asset required)
// satisfies it. See https://www.themoviedb.org/about/logos-attribution.
export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
      This product uses the TMDB API but is not endorsed or certified by{" "}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-green hover:underline"
      >
        TMDB
      </a>
      .
    </footer>
  );
}
