import Image from "next/image";

// Medals for finished challenges (public/art/badges, generated with
// Higgsfield): one per challenge type, plus the yearly watch goal.
export type BadgeKind = "GENRE" | "TIMEFRAME" | "CREW" | "LIST" | "CUSTOM" | "GOAL";

const FILES: Record<BadgeKind, string> = {
  GENRE: "genre",
  TIMEFRAME: "timeframe",
  CREW: "crew",
  LIST: "list",
  CUSTOM: "custom",
  GOAL: "goal",
};

export function ChallengeBadge({
  kind,
  size = 56,
  label = "Challenge complete",
  className = "",
}: {
  kind: BadgeKind;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Image
      src={`/art/badges/${FILES[kind]}.webp`}
      alt={label}
      title={label}
      width={size}
      height={size}
      className={`shrink-0 animate-scale-in drop-shadow-[0_4px_14px_rgba(0,224,84,0.25)] ${className}`}
    />
  );
}
