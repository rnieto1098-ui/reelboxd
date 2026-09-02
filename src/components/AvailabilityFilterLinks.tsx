import Link from "next/link";

type Variant = "sm" | "xs";

// Two visual sizes already existed independently before this was extracted:
// "sm" (home page, crew person page) and "xs" (list page, matched to its
// inline Sort chips) — preserved exactly rather than picking one and causing
// a visual regression on the other pages.
const VARIANT_CLASSES: Record<
  Variant,
  { wrapper: string; label: string; link: string; hint: string }
> = {
  sm: {
    wrapper: "flex flex-wrap items-center gap-3 text-sm",
    label: "text-muted",
    link: "rounded-full px-3 py-1 transition-colors",
    hint: "text-xs text-muted",
  },
  xs: {
    wrapper: "flex flex-wrap items-center gap-1 text-xs",
    label: "mr-1 text-muted",
    link: "rounded-full px-2.5 py-1 transition-colors",
    hint: "text-muted",
  },
};

export function AvailabilityFilterLinks({
  allHref,
  streamingHref,
  streamingOnly,
  offHref,
  offOnly = false,
  canFilterByAvailability,
  variant = "sm",
  className = "",
}: {
  allHref: string;
  streamingHref: string;
  streamingOnly: boolean;
  // Optional third "not on my services" pill — omit offHref to keep the
  // original two-way toggle (used by pages that don't need it).
  offHref?: string;
  offOnly?: boolean;
  canFilterByAvailability: boolean;
  variant?: Variant;
  className?: string;
}) {
  const c = VARIANT_CLASSES[variant];
  return (
    <div className={`${c.wrapper} ${className}`.trim()}>
      <span className={c.label}>Showing:</span>
      <Link
        href={allHref}
        className={`${c.link} ${
          !streamingOnly && !offOnly ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
        }`}
      >
        All movies
      </Link>
      <Link
        href={streamingHref}
        className={`${c.link} ${
          streamingOnly ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
        }`}
      >
        On my streaming services
      </Link>
      {offHref && (
        <Link
          href={offHref}
          className={`${c.link} ${
            offOnly ? "bg-accent-green text-black" : "text-muted hover:text-foreground"
          }`}
        >
          Not on my services
        </Link>
      )}
      {(streamingOnly || offOnly) && !canFilterByAvailability && (
        <span className={c.hint}>
          You haven&apos;t added any services or marked anything as owned yet —{" "}
          <Link href="/streaming" className="text-accent-green hover:underline">
            add your services here
          </Link>
          .
        </span>
      )}
    </div>
  );
}
