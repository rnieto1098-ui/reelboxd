import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import type { YearMovieEntry } from "@/lib/stats";

function Row({ entry, badge }: { entry: YearMovieEntry; badge: string }) {
  const poster = posterUrl(entry.posterPath, "w200");
  return (
    <Link
      href={`/movie/${entry.tmdbId}`}
      className="group flex items-center gap-3 rounded-md p-1.5 -mx-1.5 transition-colors hover:bg-surface-hover"
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded border border-border bg-background">
        {poster && (
          <Image
            src={poster}
            alt={entry.title}
            width={44}
            height={64}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm group-hover:text-accent-green">{entry.title}</p>
      <span className="shrink-0 text-xs font-medium text-accent-green">{badge}</span>
    </Link>
  );
}

export function YearMovieList({
  title,
  entries,
  badgeFor,
  emptyMessage,
}: {
  title: string;
  entries: YearMovieEntry[];
  badgeFor: (entry: YearMovieEntry) => string;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <Row key={entry.tmdbId} entry={entry} badge={badgeFor(entry)} />
          ))}
        </div>
      )}
    </div>
  );
}
