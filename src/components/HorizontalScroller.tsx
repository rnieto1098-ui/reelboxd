"use client";

import { useEffect, useRef, type ReactNode } from "react";

const SCROLL_DURATION_MS = 400;

// Ease-out cubic: fast start, gentle settle — standard curve for a "jump
// forward one screen" motion like this.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

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
  const animationFrameRef = useRef<number | null>(null);

  // Cancel a still-running animation on unmount so it doesn't keep ticking
  // (and touching a detached element) after the row is gone.
  useEffect(() => {
    return () => {
      if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  function scroll(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;

    // A repeat click while the previous animation is still running (fast
    // double-click, or spamming the arrow) cancels it outright and starts
    // fresh from the row's current position, rather than letting the two
    // fight over scrollLeft.
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const amount = el.clientWidth * 0.9;
    const startLeft = el.scrollLeft;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const target = Math.max(
      0,
      Math.min(maxScrollLeft, startLeft + (direction === "left" ? -amount : amount))
    );
    const distance = target - startLeft;
    const startTime = performance.now();

    // Driven by our own requestAnimationFrame loop — setting `scrollLeft`
    // directly every frame — rather than the browser's native
    // `behavior: "smooth"` (plus the CSS scroll-smooth class this used to
    // also carry). That native version reliably stalled partway through on
    // a long row: new poster images loading in and reflowing the layout
    // mid-scroll appears to interrupt the browser's own scroll animation,
    // leaving the arrow looking broken after one click. Driving scrollLeft
    // ourselves isn't vulnerable to that — an unrelated reflow can't
    // silently abandon an animation nothing but this loop is in charge of.
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / SCROLL_DURATION_MS);
      el.scrollLeft = startLeft + distance * easeOutCubic(t);
      animationFrameRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animationFrameRef.current = requestAnimationFrame(step);
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
            className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
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
