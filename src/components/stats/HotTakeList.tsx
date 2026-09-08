import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import type { HotTake } from "@/lib/statsCompute";
import { Card, CardLabel } from "@/components/stats/StatsPrimitives";

/**
 * One film where the user's rating and TMDB's community average pull apart.
 *
 * Both numbers are shown on TMDB's 0–10 scale (the user's stars doubled)
 * rather than converting the crowd down to stars, because halving 6.3 into
 * "3.15★" invents a precision the star scale doesn't have.
 */
function Row({ take, tone }: { take: HotTake; tone: "up" | "down" | "flat" }) {
  const poster = posterUrl(take.posterPath, "w200");
  const deltaClass =
    tone === "up" ? "text-accent-green" : tone === "down" ? "text-accent-orange" : "text-muted";
  // Signed off the *rounded* value, so a +0.04 gap doesn't render as the
  // self-contradicting "+0.0". Negative zero formats as "0.0" too.
  const rounded = Number(take.delta.toFixed(1));
  const delta = rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);

  return (
    <Link
      href={`/movie/${take.tmdbId}`}
      className="group -mx-1.5 flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-surface-hover"
    >
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded border border-border bg-background">
        {poster && (
          <Image
            src={poster}
            alt={take.title}
            width={40}
            height={56}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm group-hover:text-accent-green">{take.title}</p>
        <p className="text-[11px] tabular-nums text-muted">
          you {take.yourScore.toFixed(1)} · everyone {take.crowdScore.toFixed(1)}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${deltaClass}`}>{delta}</span>
    </Link>
  );
}

export function HotTakeList({
  label,
  description,
  takes,
  tone,
  emptyMessage,
}: {
  label: string;
  description: string;
  takes: HotTake[];
  tone: "up" | "down" | "flat";
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardLabel>{label}</CardLabel>
      <p className="-mt-2 mb-3 text-[11px] text-muted">{description}</p>
      {takes.length === 0 ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-0.5">
          {takes.map((take) => (
            <Row key={take.tmdbId} take={take} tone={tone} />
          ))}
        </div>
      )}
    </Card>
  );
}
