import type { ReleaseYearBucket } from "@/lib/stats";

const CHART_HEIGHT_PX = 180;

// Labeling every single year gets unreadable once the span crosses a
// couple decades, so only every Nth year gets a tick label — chosen from
// the actual span rather than a fixed step, so a 10-year range and a
// 100-year range both end up with a reasonable number of labels on screen.
function labelInterval(span: number): number {
  if (span <= 15) return 1;
  if (span <= 30) return 2;
  if (span <= 60) return 5;
  return 10;
}

export function ReleaseYearChart({ buckets }: { buckets: ReleaseYearBucket[] }) {
  if (buckets.length === 0) return null;

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const interval = labelInterval(buckets.length);

  return (
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-0.5"
        style={{ height: CHART_HEIGHT_PX, minWidth: buckets.length * 10 }}
      >
        {buckets.map((bucket) => {
          const showLabel = bucket.year % interval === 0;
          const heightPercent = (bucket.count / maxCount) * 100;
          return (
            <div
              key={bucket.year}
              className="group relative flex h-full flex-1 min-w-[8px] flex-col justify-end"
              title={`${bucket.year}: ${bucket.count} film${bucket.count === 1 ? "" : "s"}`}
            >
              <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                {bucket.count}
              </span>
              <div
                className="w-full rounded-t bg-accent-green transition-opacity group-hover:opacity-80"
                style={{ height: bucket.count > 0 ? `${Math.max(heightPercent, 3)}%` : "1px" }}
              />
              {showLabel && (
                <span className="mt-1.5 block -rotate-45 whitespace-nowrap text-[10px] text-muted origin-top-left">
                  {bucket.year}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
