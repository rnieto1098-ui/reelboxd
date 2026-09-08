import { formatDayKey, WEEKDAY_LABELS, type WatchHeatmap as HeatmapData } from "@/lib/statsCompute";

const CELL_PX = 11;
const GAP_PX = 3;

// Five steps of green rather than a continuous scale: a smooth gradient
// makes a 3-film day indistinguishable from a 4-film one, while discrete
// steps stay readable at 11px.
const LEVEL_CLASSES = [
  "bg-background",
  "bg-accent-green/25",
  "bg-accent-green/45",
  "bg-accent-green/70",
  "bg-accent-green",
];

function levelFor(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 1) return 4;
  return Math.min(4, Math.ceil((count / max) * 4));
}

/**
 * A year of logged watches as a GitHub-style contribution grid — the one
 * view that shows watching *habits* rather than totals: the binge weeks, the
 * dry months, the streaks.
 *
 * Scrolls horizontally rather than shrinking on narrow screens; squeezing 53
 * weeks into a phone's width would put the cells below the size where the
 * shading is distinguishable at all.
 */
export function WatchHeatmap({ data }: { data: HeatmapData }) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${data.weeks.length}, ${CELL_PX}px)`,
    gap: `${GAP_PX}px`,
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex gap-2">
        <div
          className="grid shrink-0 pt-[17px] text-[9px] text-muted"
          style={{ gridTemplateRows: `repeat(7, ${CELL_PX}px)`, gap: `${GAP_PX}px` }}
        >
          {WEEKDAY_LABELS.map((label, i) => (
            // Every other row only — seven stacked labels at 11px collide.
            <span key={label} className="leading-[11px]">
              {i % 2 === 1 ? label : ""}
            </span>
          ))}
        </div>

        <div>
          <div className="grid text-[9px] text-muted" style={columnStyle}>
            {data.weeks.map((_, weekIndex) => {
              const label = data.monthLabels.find((m) => m.weekIndex === weekIndex);
              return (
                <span key={weekIndex} className="h-[14px] whitespace-nowrap">
                  {label?.label ?? ""}
                </span>
              );
            })}
          </div>

          <div className="grid grid-flow-col" style={{ ...columnStyle, gridTemplateRows: `repeat(7, ${CELL_PX}px)` }}>
            {data.weeks.flat().map((cell) => (
              <div
                key={cell.day}
                title={
                  cell.count > 0
                    ? `${cell.count} film${cell.count === 1 ? "" : "s"} on ${formatDayKey(cell.day)}`
                    : formatDayKey(cell.day)
                }
                className={`rounded-[2px] ${LEVEL_CLASSES[levelFor(cell.count, data.maxCount)]}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted">
        <span>Less</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <span key={i} className={`h-[11px] w-[11px] rounded-[2px] ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
