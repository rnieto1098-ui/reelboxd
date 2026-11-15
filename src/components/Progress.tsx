import type { CSSProperties } from "react";

function clamp(percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

/**
 * A horizontal progress bar that fills with a short animation when it first
 * appears. The fill is a full-width strip moved with a transform inside a
 * clipped track; nothing about the page's layout changes while it animates.
 */
export function ProgressBar({
  percent,
  label,
  className = "h-2",
}: {
  percent: number | null | undefined;
  // What the bar measures, for screen readers ("2026 watch goal").
  label: string;
  className?: string;
}) {
  const value = clamp(percent);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={`overflow-hidden rounded-full bg-white/[0.08] ${className}`}
    >
      <div
        className={`h-full w-full animate-progress rounded-full ${
          value >= 100 ? "bg-accent-green" : "bg-gradient-to-r from-accent-green/70 to-accent-green"
        }`}
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </div>
  );
}

/**
 * A circular progress ring with the percentage in the middle. Decorative on
 * its own (`aria-hidden`): every place it is used states the same numbers
 * in text beside it.
 */
export function ProgressRing({
  percent,
  size = 56,
  stroke = 5,
  children,
}: {
  percent: number | null | undefined;
  size?: number;
  stroke?: number;
  // Replaces the percentage in the centre (a tick, an icon).
  children?: React.ReactNode;
}) {
  const value = clamp(percent);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const complete = value >= 100;
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value / 100)}
          className="animate-ring stroke-accent-green"
          style={{ "--ring-length": length } as CSSProperties}
        />
      </svg>
      <span
        className={`absolute text-[13px] font-bold tabular-nums ${
          complete ? "text-accent-green" : "text-foreground"
        }`}
      >
        {children ?? `${Math.round(value)}%`}
      </span>
    </span>
  );
}
