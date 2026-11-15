import Image from "next/image";
import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Browse",
    links: [
      { href: "/", label: "Home" },
      { href: "/lists", label: "Lists" },
      { href: "/crew", label: "Cast and crew" },
      { href: "/search", label: "Search" },
    ],
  },
  {
    title: "Your films",
    links: [
      { href: "/watchlist", label: "Watchlist" },
      { href: "/challenges", label: "Challenges" },
      { href: "/recommend", label: "Recommendations" },
      { href: "/play", label: "Daily game" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/settings", label: "Settings" },
      { href: "/streaming", label: "Streaming services" },
      { href: "/import", label: "Import from Letterboxd" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

// TMDB's API terms require attributing them as the data source on any
// public page using their data — text attribution (no logo asset required)
// satisfies it. See https://www.themoviedb.org/about/logos-attribution.
export function Footer() {
  return (
    // mb on small screens keeps the last line clear of the fixed tab bar.
    <footer className="mt-8 border-t border-white/[0.06] bg-background/60 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="container-page py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight"
            >
              <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
              <span>
                Flix<span className="text-accent-green">tally</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Keep a tally of every film you watch, and find the next one worth your evening.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:contents">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  {column.title}
                </h2>
                <ul className="space-y-2 text-sm">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/[0.06] pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Flixtally</p>
          <p>
            This product uses the TMDB API but is not endorsed or certified by{" "}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted underline-offset-2 hover:text-accent-green hover:underline"
            >
              TMDB
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
