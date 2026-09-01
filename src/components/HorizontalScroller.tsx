"use client";

import { useRef, type ReactNode } from "react";

export function HorizontalScroller({
  title,
  headerAction,
  isEmpty,
  emptyMessage,
  children,
}: {
  title?: string;
  headerAction?: ReactNode;
  isEmpty: boolean;
  emptyMessage?: ReactNode;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.9;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <section>
      {(title || headerAction) && (
        <div className="mb-3 flex items-center justify-between gap-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {headerAction}
        </div>
      )}
      {isEmpty && emptyMessage ? (
        <p className="text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="group/row relative">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-center bg-gradient-to-r from-background to-transparent text-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
          >
            <ChevronIcon direction="left" />
          </button>

          <div
            ref={scrollerRef}
            className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0"
          >
            {children}
          </div>

          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-center bg-gradient-to-l from-background to-transparent text-foreground opacity-0 transition-opacity group-hover/row:opacity-100"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      )}
    </section>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}
