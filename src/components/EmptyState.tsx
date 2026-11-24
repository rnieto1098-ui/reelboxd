import Image from "next/image";
import type { ReactNode } from "react";

// Illustrations for empty pages (public/art/empty, generated with Higgsfield).
export type EmptyArt =
  | "watchlist"
  | "rewatch"
  | "challenges"
  | "list"
  | "diary"
  | "ratings"
  | "owned"
  | "nothing-on";

/**
 * What a page shows before there's anything on it: an illustration, a short
 * heading, and a line on how to fill it. The art is drawn on near-black and
 * its edges fade out, so it sits on the page rather than in a box.
 */
export function EmptyState({
  art,
  title,
  children,
  action,
  className = "",
}: {
  art: EmptyArt;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto flex max-w-md flex-col items-center py-6 text-center ${className}`}>
      <Image
        src={`/art/empty/${art}.webp`}
        alt=""
        width={480}
        height={360}
        sizes="(max-width: 640px) 80vw, 320px"
        className="empty-art mb-4 h-auto w-64 sm:w-80"
      />
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
