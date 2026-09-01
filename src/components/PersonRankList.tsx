import Link from "next/link";
import type { PersonCount, PersonRating } from "@/lib/peopleStats";

function Row({
  rank,
  name,
  personId,
  value,
}: {
  rank: number;
  name: string;
  personId: number;
  value: string;
}) {
  return (
    <Link
      href={`/crew/person/${personId}`}
      className="flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 transition-colors hover:bg-surface-hover"
    >
      <span className="w-4 shrink-0 text-right text-xs text-muted">{rank}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <span className="shrink-0 text-xs font-medium text-accent-green">{value}</span>
    </Link>
  );
}

export function PersonRankList({
  title,
  mostWatched,
  highestRated,
}: {
  title: string;
  mostWatched: PersonCount[];
  highestRated: PersonRating[];
}) {
  if (mostWatched.length === 0 && highestRated.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Most watched
          </p>
          {mostWatched.length === 0 ? (
            <p className="text-sm text-muted">Not enough data yet.</p>
          ) : (
            <div>
              {mostWatched.map((p, i) => (
                <Row
                  key={p.id}
                  rank={i + 1}
                  personId={p.id}
                  name={p.name}
                  value={`${p.count}×`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Highest rated
          </p>
          {highestRated.length === 0 ? (
            <p className="text-sm text-muted">Not enough rated films yet.</p>
          ) : (
            <div>
              {highestRated.map((p, i) => (
                <Row
                  key={p.id}
                  rank={i + 1}
                  personId={p.id}
                  name={p.name}
                  value={`${p.avgRating.toFixed(1)}★`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
