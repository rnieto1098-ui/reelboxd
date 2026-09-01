import Link from "next/link";
import type { SortDir } from "@/lib/sortComparator";

// The "Sort:" chip row existed nearly identically on the watchlist, list
// detail, and profile pages — same look, same active/direction logic,
// diverging only in what each key's href actually points at. Callers supply
// that via `hrefFor` so this stays a pure presentational component.
export function SortChips<K extends string>({
  options,
  activeKey,
  activeDir,
  hrefFor,
}: {
  options: { key: K; label: string }[];
  activeKey: K;
  activeDir: SortDir;
  hrefFor: (key: K, nextDir: SortDir) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted">Sort:</span>
      {options.map(({ key, label }) => {
        const isActive = key === activeKey;
        // Clicking the already-active sort flips its direction; clicking a
        // different one starts it at the default direction.
        const nextDir: SortDir = isActive ? (activeDir === "desc" ? "asc" : "desc") : "desc";
        return (
          <Link
            key={key}
            href={hrefFor(key, nextDir)}
            className={`rounded-full px-2.5 py-1 transition-colors ${
              isActive ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
            {isActive && <span className="ml-1">{activeDir === "asc" ? "↑" : "↓"}</span>}
          </Link>
        );
      })}
    </div>
  );
}
