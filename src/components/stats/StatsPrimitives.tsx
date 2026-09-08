import type { ReactNode } from "react";

/**
 * The shared shells every stats section is built out of. Kept together so
 * the page reads as one designed surface rather than a stack of unrelated
 * widgets — the previous version repeated four slightly different card and
 * bar treatments inline.
 */

export function StatTile({
  label,
  value,
  hint,
  tone = "green",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "green" | "blue" | "orange" | "plain";
}) {
  const toneClass = {
    green: "text-accent-green",
    blue: "text-accent-blue",
    orange: "text-accent-orange",
    plain: "text-foreground",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-surface-hover">
      <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted/70">{hint}</p>}
    </div>
  );
}

export function StatSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</div>
  );
}

export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{children}</p>
  );
}

export type BarRow = {
  key: string;
  label: string;
  count: number;
  /** Rendered on the right instead of the raw count, when present. */
  badge?: string | null;
};

/**
 * Horizontal bars sharing one scale, used for genres, decades, runtimes and
 * certifications. Bars are widened to a visible minimum so a category with
 * one film still reads as a bar rather than as an empty row.
 */
export function BarList({
  rows,
  accent = "green",
  labelWidth = "w-24",
}: {
  rows: BarRow[];
  accent?: "green" | "blue" | "orange";
  labelWidth?: string;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const barClass = {
    green: "bg-accent-green",
    blue: "bg-accent-blue",
    orange: "bg-accent-orange",
  }[accent];

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2 text-xs">
          <span className={`${labelWidth} shrink-0 truncate text-muted`} title={row.label}>
            {row.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-background">
            <div
              className={`h-full rounded-sm ${barClass}`}
              style={{ width: row.count > 0 ? `${Math.max((row.count / max) * 100, 2)}%` : 0 }}
            />
          </div>
          <span className="w-14 shrink-0 text-right tabular-nums text-muted">
            {row.badge ?? row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
