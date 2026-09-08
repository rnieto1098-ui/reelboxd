import type { RhythmBucket } from "@/lib/statsCompute";

const CHART_HEIGHT_PX = 90;

/**
 * Compact vertical columns for the two cyclical cuts of the diary — logs by
 * weekday and by calendar month, every year collapsed together.
 *
 * The peak column is highlighted rather than left to the reader to spot,
 * since "when do you actually watch films" is the whole point of the chart
 * and the difference between the top two bars is often a few pixels.
 */
export function RhythmColumns({
  buckets,
  accent = "green",
}: {
  buckets: RhythmBucket[];
  accent?: "green" | "blue";
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const peakClass = accent === "green" ? "bg-accent-green" : "bg-accent-blue";

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT_PX }}>
        {buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${bucket.label}: ${bucket.count} log${bucket.count === 1 ? "" : "s"}`}
          >
            <div
              className={`w-full rounded-t-sm ${
                bucket.count === max && max > 0 ? peakClass : "bg-border"
              }`}
              style={{ height: `${Math.max((bucket.count / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {buckets.map((bucket) => (
          <span
            key={bucket.label}
            className={`flex-1 truncate text-center text-[10px] ${
              bucket.count === max && max > 0 ? "text-foreground" : "text-muted"
            }`}
          >
            {bucket.label.slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}
