"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SCROLL_DURATION_MS = 450;

// Ease-out cubic: fast start, gentle settle — standard curve for a "jump
// forward one screen" motion like this.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function HorizontalScroller({
  title,
  href,
  headerAction,
  isEmpty,
  // Defaulted rather than optional-at-the-render-site: this used to only
  // show a message when a caller passed one, so the rows that didn't
  // (ListRow, PersonRow, StudioRow, UpcomingReleasesRow) rendered a heading
  // over an empty scroller — complete with hover arrows scrolling nothing —
  // whenever a TMDB call came back empty or the account was new.
  emptyMessage = "Nothing here yet.",
  children,
}: {
  title?: string;
  // Makes the heading a link to a page showing the whole collection.
  href?: string;
  headerAction?: ReactNode;
  isEmpty: boolean;
  emptyMessage?: ReactNode;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Which directions there is anything left to scroll toward. Arrows for a
  // direction with nothing in it aren't shown at all.
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 };
    // Scroll events fire every frame; only re-render when an arrow actually
    // needs to appear or disappear.
    setCanScroll((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // Covers window resizes and posters arriving late and widening the row.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
      // Cancel a still-running animation on unmount so it doesn't keep
      // ticking (and touching a detached element) after the row is gone.
      if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [measure, isEmpty]);

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

    const amount = el.clientWidth * 0.85;
    const startLeft = el.scrollLeft;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const target = Math.max(
      0,
      Math.min(maxScrollLeft, startLeft + (direction === "left" ? -amount : amount))
    );
    const distance = target - startLeft;

    // This animation runs in JavaScript, so the stylesheet's reduced-motion
    // rule can't reach it: honour the preference here by jumping straight
    // to the destination.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = target;
      return;
    }

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

  // Round, floating, and only present when there is somewhere to go. They
  // appear on row hover or keyboard focus; touch users swipe instead.
  const arrowClass =
    "absolute top-[calc(50%-2.25rem)] z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-background/85 text-foreground opacity-0 shadow-pop backdrop-blur-md transition-[opacity,transform,background-color] duration-200 hover:scale-110 hover:bg-surface-hover focus-visible:opacity-100 group-hover/row:opacity-100 sm:flex";

  return (
    <section>
      {(title || headerAction) && (
        <div className="mb-3 flex items-center justify-between gap-4 sm:mb-4">
          {title &&
            (href ? (
              <h2 className="section-title">
                <Link href={href} className="group/title inline-flex items-center gap-1 hover:text-accent-green">
                  {title}
                  <ChevronRight
                    aria-hidden
                    className="h-4 w-4 text-muted transition-transform duration-200 group-hover/title:translate-x-0.5 group-hover/title:text-accent-green"
                  />
                </Link>
              </h2>
            ) : (
              <h2 className="section-title">{title}</h2>
            ))}
          {headerAction}
        </div>
      )}
      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-sm text-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="group/row relative">
          {canScroll.left && (
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className={`${arrowClass} -left-3 lg:-left-5`}
            >
              <ChevronLeft aria-hidden className="h-5 w-5" />
            </button>
          )}

          {/* The row runs to the edge of the screen (cancelling the page's
              side padding) so posters slide off under the edge instead of
              stopping short of it. py leaves room for the hover lift, which
              a scrolling container would otherwise clip. */}
          <div
            ref={scrollerRef}
            className="no-scrollbar -mx-4 -my-2 flex gap-3 overflow-x-auto px-4 py-2 sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-10 lg:px-10"
          >
            {children}
          </div>

          {canScroll.right && (
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className={`${arrowClass} -right-3 lg:-right-5`}
            >
              <ChevronRight aria-hidden className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
