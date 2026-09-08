import type { RatingHistogram } from "@/lib/statsCompute";

const CHART_HEIGHT_PX = 120;

/**
 * The rating distribution as vertical columns under a half-star axis.
 *
 * Vertical rather than the horizontal bars the rest of the page uses: this
 * is the one chart whose axis is an ordered scale people already picture
 * left-to-right, and the shape of the curve (where the hump sits, how long
 * the low-star tail is) is the actual information.
 */
export function RatingColumns({ histogram }: { histogram: RatingHistogram }) {
  const max = Math.max(1, ...histogram.buckets.map((b) => b.count));

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: CHART_HEIGHT_PX }}>
        {histogram.buckets.map((bucket) => (
          <div
            key={bucket.score}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${bucket.score}★ — ${bucket.count} film${bucket.count === 1 ? "" : "s"} (${bucket.percent.toFixed(0)}%)`}
          >
            <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {bucket.count}
            </span>
            <div
              className="w-full rounded-t-sm bg-accent-green transition-opacity group-hover:opacity-80"
              style={{
                height: bucket.count > 0 ? `${Math.max((bucket.count / max) * 100, 2)}%` : "2px",
                // A zero bucket still gets a hairline so the axis reads as
                // continuous instead of having holes punched in it.
                opacity: bucket.count > 0 ? 1 : 0.25,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {histogram.buckets.map((bucket) => (
          <span key={bucket.score} className="flex-1 text-center text-[10px] text-muted">
            {/* Only whole stars get a label — ten labels in this width collide. */}
            {Number.isInteger(bucket.score) ? `${bucket.score}★` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
