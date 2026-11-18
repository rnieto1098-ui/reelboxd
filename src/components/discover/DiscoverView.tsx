"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, Check, Clapperboard, Eye, Play, Shuffle, ThumbsDown, Undo2 } from "lucide-react";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { PosterImage } from "@/components/PosterImage";
import { Dialog } from "@/components/Dialog";
import { StarRating } from "@/components/StarRating";
import { backdropUrl, logoUrl, posterUrl } from "@/lib/tmdb";
import { weightedPick } from "@/lib/discover/taste";
import type { DiscoverFilm, DiscoverRowData, DiscoverService } from "@/lib/discover/feed";
import { useFilmActions } from "@/components/discover/useFilmActions";

type CardState = "seen" | "dismissed";

export function DiscoverView({
  rows,
  services,
  watchlistIds,
}: {
  rows: DiscoverRowData[];
  services: DiscoverService[];
  watchlistIds: number[];
}) {
  const actions = useFilmActions();
  const servicesById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const [watchlist, setWatchlist] = useState(() => new Set(watchlistIds));
  // Films acted on this visit. They stay in place as a small "undo" tile
  // rather than vanishing, so a mis-tap is one tap to take back.
  const [states, setStates] = useState<Map<number, CardState>>(new Map());
  const [spotlight, setSpotlight] = useState<{ film: DiscoverFilm; picked: boolean } | null>(null);
  const [rating, setRating] = useState<DiscoverFilm | null>(null);
  const shownPicks = useRef(new Set<DiscoverFilm>());

  // Every film on the page, best match first, for "Pick one for me".
  const allFilms = useMemo(() => {
    const byId = new Map<number, DiscoverFilm>();
    for (const row of rows) for (const f of row.films) if (!byId.has(f.id)) byId.set(f.id, f);
    return [...byId.values()].sort((a, b) => b.score - a.score);
  }, [rows]);

  function setState(id: number, state: CardState | null) {
    setStates((prev) => {
      const next = new Map(prev);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });
  }

  async function toggleWatchlist(film: DiscoverFilm) {
    const on = !watchlist.has(film.id);
    const apply = (value: boolean) =>
      setWatchlist((prev) => {
        const next = new Set(prev);
        if (value) next.add(film.id);
        else next.delete(film.id);
        return next;
      });
    apply(on);
    const ok = await actions.setWatchlist(film.id, on);
    if (!ok) apply(!on);
    else actions.showToast(on ? `Added ${film.title} to your watchlist` : "Removed from your watchlist");
  }

  async function markSeen(film: DiscoverFilm) {
    setState(film.id, "seen");
    setSpotlight(null);
    if (await actions.markSeen(film.id)) setRating(film);
    else setState(film.id, null);
  }

  async function dismiss(film: DiscoverFilm) {
    setState(film.id, "dismissed");
    setSpotlight(null);
    if (!(await actions.dismiss(film.id))) setState(film.id, null);
  }

  async function undoDismiss(film: DiscoverFilm) {
    setState(film.id, null);
    if (!(await actions.undismiss(film.id))) setState(film.id, "dismissed");
  }

  function pickOne() {
    const available = allFilms.filter((f) => !states.has(f.id));
    let pick = weightedPick(available, shownPicks.current);
    if (!pick) {
      // Seen every one of the best: start the cycle again.
      shownPicks.current.clear();
      pick = weightedPick(available, shownPicks.current);
    }
    if (!pick) return;
    shownPicks.current.add(pick);
    setSpotlight({ film: pick, picked: true });
  }

  const cardProps = {
    servicesById,
    watchlist,
    states,
    onSpotlight: (film: DiscoverFilm) => setSpotlight({ film, picked: false }),
    onWatchlist: toggleWatchlist,
    onSeen: markSeen,
    onDismiss: dismiss,
    onUndo: undoDismiss,
  };

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" onClick={pickOne} className="btn btn-primary">
          <Shuffle aria-hidden className="h-4 w-4" />
          Pick one for me
        </button>
        <p className="hidden text-sm text-muted sm:block">
          Can&apos;t decide? We&apos;ll choose from your best matches.
        </p>
      </div>

      <div className="space-y-10 sm:space-y-12">
        {rows.map((row) => (
          <section key={row.key}>
            <div className="mb-3 sm:mb-4">
              <h2 className="section-title">{row.title}</h2>
              {row.subtitle && <p className="mt-0.5 text-sm text-muted">{row.subtitle}</p>}
            </div>
            <HorizontalScroller isEmpty={false}>
              {row.films.map((film, i) => (
                <div key={film.id} className="row-card">
                  <DiscoverCard film={film} priority={i < 4 && row === rows[0]} {...cardProps} />
                </div>
              ))}
            </HorizontalScroller>
          </section>
        ))}
      </div>

      {spotlight && (
        <Spotlight
          key={spotlight.film.id}
          film={spotlight.film}
          picked={spotlight.picked}
          servicesById={servicesById}
          inWatchlist={watchlist.has(spotlight.film.id)}
          onClose={() => setSpotlight(null)}
          onAnother={pickOne}
          onWatchlist={() => toggleWatchlist(spotlight.film)}
          onSeen={() => markSeen(spotlight.film)}
          onDismiss={() => dismiss(spotlight.film)}
        />
      )}

      {rating && (
        <Dialog
          title={`How was ${rating.title}?`}
          size="sm"
          onClose={() => setRating(null)}
          footer={
            <button type="button" className="btn btn-secondary" onClick={() => setRating(null)}>
              Done
            </button>
          }
        >
          <p className="mb-4 text-sm text-muted">
            Marked as seen. A rating sharpens what Discover suggests next; skip it if you like.
          </p>
          <div className="flex justify-center py-2">
            <StarRating tmdbId={rating.id} initialScore={null} signedIn />
          </div>
        </Dialog>
      )}
    </>
  );
}

function ServiceBadge({ service, size = 22 }: { service: DiscoverService; size?: number }) {
  const src = logoUrl(service.logoPath, "w92");
  if (!src) return null;
  return (
    <span
      title={`On ${service.name}`}
      className="block overflow-hidden rounded-md ring-1 ring-black/40"
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={`On ${service.name}`} width={size} height={size} className="h-full w-full" />
    </span>
  );
}

const actionClass =
  "flex h-7 w-7 items-center justify-center rounded-full text-muted transition-[background-color,color,transform] duration-150 hover:bg-white/10 hover:text-foreground active:scale-90";

function DiscoverCard({
  film,
  priority,
  servicesById,
  watchlist,
  states,
  onSpotlight,
  onWatchlist,
  onSeen,
  onDismiss,
  onUndo,
}: {
  film: DiscoverFilm;
  priority: boolean;
  servicesById: Map<number, DiscoverService>;
  watchlist: Set<number>;
  states: Map<number, CardState>;
  onSpotlight: (film: DiscoverFilm) => void;
  onWatchlist: (film: DiscoverFilm) => void;
  onSeen: (film: DiscoverFilm) => void;
  onDismiss: (film: DiscoverFilm) => void;
  onUndo: (film: DiscoverFilm) => void;
}) {
  const state = states.get(film.id);
  const service = film.providerIds.map((id) => servicesById.get(id)).find(Boolean);
  const inWatchlist = watchlist.has(film.id);

  if (state) {
    return (
      <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong p-3 text-center">
        {state === "seen" ? (
          <>
            <Check aria-hidden className="h-6 w-6 text-accent-green" />
            <p className="text-xs text-muted">Marked as seen</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">Hidden. You won&apos;t see it here again.</p>
            <button type="button" onClick={() => onUndo(film)} className="btn btn-ghost btn-sm">
              <Undo2 aria-hidden className="h-3.5 w-3.5" />
              Undo
            </button>
          </>
        )}
        <p className="line-clamp-2 text-[11px] text-subtle">{film.title}</p>
      </div>
    );
  }

  return (
    <div className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface ring-1 ring-white/[0.08] transition-[transform,box-shadow] duration-300 ease-out-expo group-hover:-translate-y-1 group-hover:shadow-pop group-hover:ring-white/25">
        <Link href={`/movie/${film.id}`} className="absolute inset-0">
          <PosterImage src={posterUrl(film.posterPath)} alt={film.title} year={film.year ?? undefined} priority={priority} />
        </Link>
        {service && (
          <span className="pointer-events-none absolute left-1.5 top-1.5">
            <ServiceBadge service={service} />
          </span>
        )}
      </div>
      <Link
        href={`/movie/${film.id}`}
        title={film.title}
        tabIndex={-1}
        className="mt-2 line-clamp-2 min-h-[2.375rem] text-[13px] font-medium leading-[1.1875rem] text-foreground/90 group-hover:text-foreground"
      >
        {film.title}
      </Link>
      <p className="mt-0.5 text-xs text-subtle">{film.year}</p>
      {film.reason && (
        <p className="truncate text-[11px] font-medium text-accent-green/90">You like {film.reason}</p>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSpotlight(film)}
          aria-label={`Watch tonight: ${film.title}`}
          title="Watch tonight"
          className={actionClass}
        >
          <Clapperboard aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onWatchlist(film)}
          aria-label={inWatchlist ? `Remove ${film.title} from watchlist` : `Add ${film.title} to watchlist`}
          aria-pressed={inWatchlist}
          title={inWatchlist ? "On your watchlist" : "Add to watchlist"}
          className={`${actionClass} ${inWatchlist ? "text-accent-green" : ""}`}
        >
          <Bookmark aria-hidden className={`h-4 w-4 ${inWatchlist ? "fill-current" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => onSeen(film)}
          aria-label={`I've seen ${film.title}`}
          title="Seen it"
          className={actionClass}
        >
          <Eye aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss(film)}
          aria-label={`Not for me: ${film.title}`}
          title="Not for me"
          className={actionClass}
        >
          <ThumbsDown aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

type SpotlightDetails = {
  runtime: number | null;
  tagline: string | null;
  overview: string;
  genres: string[];
  director: string | null;
  trailerKey: string | null;
  watchLink: string | null;
};

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function Spotlight({
  film,
  picked,
  servicesById,
  inWatchlist,
  onClose,
  onAnother,
  onWatchlist,
  onSeen,
  onDismiss,
}: {
  film: DiscoverFilm;
  picked: boolean;
  servicesById: Map<number, DiscoverService>;
  inWatchlist: boolean;
  onClose: () => void;
  onAnother: () => void;
  onWatchlist: () => void;
  onSeen: () => void;
  onDismiss: () => void;
}) {
  const [details, setDetails] = useState<SpotlightDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/discover/spotlight/${film.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SpotlightDetails) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [film.id]);

  const backdrop = backdropUrl(film.backdropPath, "w780");
  const services = film.providerIds.map((id) => servicesById.get(id)).filter((s): s is DiscoverService => !!s);
  const facts = [film.year, formatRuntime(details?.runtime ?? null), details?.genres.slice(0, 3).join(", ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog title={film.title} hideTitle bare size="lg" onClose={onClose}>
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="relative aspect-video w-full bg-black">
          {playing && details?.trailerKey ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(details.trailerKey)}?autoplay=1&rel=0`}
              title={`${film.title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          ) : (
            <>
              {backdrop && (
                <Image src={backdrop} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-raised via-surface-raised/30 to-transparent" />
              {details?.trailerKey && (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur-md transition-transform hover:scale-105"
                  aria-label={`Play the ${film.title} trailer`}
                >
                  <Play aria-hidden className="ml-1 h-7 w-7 fill-current" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-md"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 pb-5 pt-1 sm:px-7 sm:pb-7">
          {picked && <p className="eyebrow">Tonight&apos;s pick</p>}
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
              {film.title}
            </h2>
            {facts && <p className="mt-1 text-sm text-muted">{facts}</p>}
            {details?.director && <p className="text-sm text-muted">Directed by {details.director}</p>}
          </div>

          {details?.tagline && <p className="italic text-foreground/80">{details.tagline}</p>}
          <p className="text-sm leading-relaxed text-foreground/85">{details?.overview}</p>
          {failed && <p className="text-xs text-subtle">Couldn&apos;t load more details right now.</p>}

          {services.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Streaming on</span>
              {services.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-sm font-medium">
                  <ServiceBadge service={s} size={24} />
                  {s.name}
                </span>
              ))}
              {details?.watchLink && (
                <a
                  href={details.watchLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent-green underline-offset-2 hover:underline"
                >
                  Where to watch
                </a>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={onWatchlist} className={inWatchlist ? "btn btn-active" : "btn btn-primary"}>
              <Bookmark aria-hidden className={`h-4 w-4 ${inWatchlist ? "fill-current" : ""}`} />
              {inWatchlist ? "On your watchlist" : "Add to watchlist"}
            </button>
            <Link href={`/movie/${film.id}`} className="btn btn-secondary">
              Film page
            </Link>
            {picked && (
              <button type="button" onClick={onAnother} className="btn btn-secondary">
                <Shuffle aria-hidden className="h-4 w-4" />
                Pick another
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="button" onClick={onSeen} className="btn btn-ghost btn-sm">
              <Eye aria-hidden className="h-4 w-4" />
              Seen it
            </button>
            <button type="button" onClick={onDismiss} className="btn btn-ghost btn-sm">
              <ThumbsDown aria-hidden className="h-4 w-4" />
              Not for me
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
