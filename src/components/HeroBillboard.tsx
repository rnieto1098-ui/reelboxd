"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Info, Star } from "lucide-react";
import { useToggleAction } from "@/lib/useToggleAction";

export type BillboardItem = {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  backdrop: string;
  // TMDB's 0-10 average, or null when too few people have voted to mean much.
  rating: number | null;
  genres: string[];
  inWatchlist: boolean;
};

// How long each film stays up before the next one fades in.
const SLIDE_MS = 9000;

/**
 * The large featured-film panel at the top of the home page: a still from
 * each of this week's trending films, rotating on a timer.
 *
 * The timer is the progress bar itself. Its CSS animation runs for
 * SLIDE_MS and `animationend` advances the slide, so pausing (hover,
 * keyboard focus, a hidden tab) is just `animation-play-state: paused` with
 * no clock to keep in sync. People who have asked their device for reduced
 * motion get no rotation at all, only the arrows.
 */
export function HeroBillboard({ items, signedIn }: { items: BillboardItem[]; signedIn: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAutoplay(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  if (items.length === 0) return null;
  // The list can shrink after a refresh (a film just marked watched drops
  // out), so never trust a stored index past the end.
  const current = Math.min(index, items.length - 1);
  const item = items[current];
  const go = (delta: number) => setIndex((current + delta + items.length) % items.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Trending this week"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="bleed relative -mt-8 mb-10 h-[68vh] max-h-[660px] min-h-[440px] overflow-hidden bg-surface sm:h-[62vh]"
    >
      {items.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== current}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={slide.backdrop}
            alt=""
            fill
            sizes="100vw"
            priority={i === 0}
            className="object-cover object-[center_20%]"
          />
        </div>
      ))}
      <div aria-hidden className="scrim-left absolute inset-0 hidden sm:block" />
      <div aria-hidden className="scrim-bottom absolute inset-0" />

      <div className="container-page absolute inset-x-0 bottom-0 pb-12 sm:pb-14">
        {/* Keyed so the text block replays its entrance for each film. */}
        <div key={item.id} className="max-w-2xl animate-fade-up">
          <p className="eyebrow mb-3">Trending this week</p>
          <h2 className="text-balance text-3xl font-extrabold leading-[1.05] tracking-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
            {item.title}
          </h2>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-foreground/85">
            {item.rating != null && (
              <span className="flex items-center gap-1 text-accent-gold">
                <Star aria-hidden className="h-4 w-4 fill-current" />
                <span className="sr-only">Rated</span>
                {item.rating.toFixed(1)}
              </span>
            )}
            {item.year && <span>{item.year}</span>}
            {item.genres.length > 0 && <span>{item.genres.slice(0, 3).join(" · ")}</span>}
          </p>
          {item.overview && (
            <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-foreground/80 sm:line-clamp-3 sm:text-base">
              {item.overview}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/movie/${item.id}`} className="btn btn-primary btn-lg">
              <Info aria-hidden className="h-5 w-5" />
              View details
            </Link>
            <BillboardWatchlistButton
              key={item.id}
              tmdbId={item.id}
              initialInWatchlist={item.inWatchlist}
              signedIn={signedIn}
            />
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="container-page absolute inset-x-0 bottom-4 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5 sm:max-w-xs" role="tablist" aria-label="Featured films">
            {items.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`Show ${slide.title}`}
                onClick={() => setIndex(i)}
                // The visible bar is 3px; the padding makes it a comfortable
                // target for a finger.
                className="group/dot h-6 flex-1 py-[10.5px]"
              >
                <span className="block h-full overflow-hidden rounded-full bg-white/25 transition-colors group-hover/dot:bg-white/40">
                  {i === current &&
                    (autoplay ? (
                      <span
                        className="block h-full origin-left rounded-full bg-accent-green"
                        style={{
                          animation: `progress-grow ${SLIDE_MS}ms linear both`,
                          animationPlayState: paused ? "paused" : "running",
                        }}
                        onAnimationEnd={() => go(1)}
                      />
                    ) : (
                      <span className="block h-full rounded-full bg-accent-green" />
                    ))}
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto hidden gap-2 sm:flex">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous film"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-foreground backdrop-blur-md transition-colors hover:bg-white/15"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next film"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-foreground backdrop-blur-md transition-colors hover:bg-white/15"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BillboardWatchlistButton({
  tmdbId,
  initialInWatchlist,
  signedIn,
}: {
  tmdbId: number;
  initialInWatchlist: boolean;
  signedIn: boolean;
}) {
  const { active, saving, toggle } = useToggleAction(
    initialInWatchlist,
    `/api/movies/${tmdbId}/watchlist`,
    signedIn,
    ["Added to watchlist", "Removed from watchlist"],
    (body, attempted) =>
      (body as { blockedByWatched?: boolean })?.blockedByWatched
        ? {
            active: false,
            message: "You've already watched this — it's not going on your watchlist.",
          }
        : { active: attempted }
  );
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-pressed={active}
      className="btn btn-secondary btn-lg backdrop-blur-md"
    >
      {active ? (
        <BookmarkCheck aria-hidden className="h-5 w-5 text-accent-green" />
      ) : (
        <Bookmark aria-hidden className="h-5 w-5" />
      )}
      {active ? "On your watchlist" : "Watchlist"}
    </button>
  );
}
