import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import type { RankedMovie } from "@/lib/statsCompute";
import { Card, CardLabel } from "@/components/stats/StatsPrimitives";

function Row({ entry, badge }: { entry: RankedMovie; badge: string }) {
  const poster = posterUrl(entry.posterPath, "w200");
  return (
    <Link
      href={`/movie/${entry.tmdbId}`}
      className="group -mx-1.5 flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-surface-hover"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-background">
        {poster && (
          <Image
            src={poster}
            alt={entry.title}
            width={40}
            height={56}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-sm group-hover:text-accent-green">{entry.title}</p>
      <span className="shrink-0 text-xs font-medium tabular-nums text-accent-green">{badge}</span>
    </Link>
  );
}

export function MovieRankList({
  label,
  entries,
  badgeFor,
  emptyMessage,
}: {
  label: string;
  entries: RankedMovie[];
  badgeFor: (entry: RankedMovie) => string;
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardLabel>{label}</CardLabel>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-0.5">
          {entries.map((entry) => (
            <Row key={entry.tmdbId} entry={entry} badge={badgeFor(entry)} />
          ))}
        </div>
      )}
    </Card>
  );
}
