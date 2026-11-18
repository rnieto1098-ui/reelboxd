"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { ArrowLeft, Bookmark, ExternalLink, Play } from "lucide-react";
import { backdropUrl, logoUrl, posterUrl } from "@/lib/tmdb";
import { watchLink } from "@/lib/couch/providerLinks";
import type { CouchData, CouchFilm, CouchService } from "@/lib/couch/data";
import { useFilmActions } from "@/components/discover/useFilmActions";

// The interface drawn on the Couch TV. Our own design (not a copy of any
// service's app): a home screen of your services, each service's rows of
// films, and a film screen that sends you to the service to watch.
//
// Everything is sized in em off one font size set from the screen's width
// (container query units), so the whole interface scales with the TV.
// Arrow keys move a highlight like a remote, Enter selects, Escape or
// Backspace goes back; mouse and touch work as normal.

type Screen =
  | { kind: "home" }
  | { kind: "service"; serviceId: number }
  | { kind: "film"; filmId: number; serviceId: number | null };

type Details = {
  runtime: number | null;
  overview: string;
  genres: string[];
  trailerKey: string | null;
  watchLink: string | null;
};

const FOCUSABLE = "[data-tv]";

type Direction = "left" | "right" | "up" | "down";

// The arrow keys and WASD both work as the remote's direction pad.
const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
};

function remoteDirection(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): Direction | undefined {
  // Leave shortcuts like Ctrl+S or Cmd+A to the browser.
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return KEY_DIRECTIONS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
}

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
}
function clockText() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Scrolls whichever rows or lists inside the TV hold `el` so it's in view. */
function ensureVisible(el: HTMLElement, root: HTMLElement) {
  let p = el.parentElement;
  while (p && root.contains(p)) {
    const er = el.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    if (p.scrollWidth > p.clientWidth + 1) {
      const pad = pr.width * 0.05;
      if (er.left < pr.left + pad) p.scrollBy({ left: er.left - pr.left - pad, behavior: "smooth" });
      else if (er.right > pr.right - pad) p.scrollBy({ left: er.right - pr.right + pad, behavior: "smooth" });
    }
    if (p.scrollHeight > p.clientHeight + 1) {
      const pad = pr.height * 0.06;
      if (er.top < pr.top + pad) p.scrollBy({ top: er.top - pr.top - pad, behavior: "smooth" });
      else if (er.bottom > pr.bottom - pad) p.scrollBy({ top: er.bottom - pr.bottom + pad, behavior: "smooth" });
    }
    p = p.parentElement;
  }
}

/** Moves focus to the nearest item in a direction, the way a TV remote does. */
function moveFocus(root: HTMLElement, dir: Direction) {
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const current = document.activeElement as HTMLElement | null;
  if (!current || !items.includes(current)) {
    items[0]?.focus({ preventScroll: true });
    return;
  }
  const r = current.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - cx;
    const dy = b.top + b.height / 2 - cy;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    if (along <= 2) continue;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    // Strongly prefer staying in the same row (or column) over a closer
    // item off to the side.
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus({ preventScroll: true });
    ensureVisible(best, root);
  }
}

const focusRing =
  "outline-none transition-[transform,box-shadow] duration-150 focus-visible:scale-[1.07] focus-visible:shadow-[0_0_0_0.18em_#fff,0_0.5em_1.4em_rgba(0,0,0,0.6)] hover:scale-[1.04]";

export function CouchTv({ data, username }: { data: CouchData; username: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [history, setHistory] = useState<Screen[]>([]);
  const [focusedFilm, setFocusedFilm] = useState<number | null>(null);
  const [watchlist, setWatchlist] = useState(() => new Set(data.watchlistIds));
  const actions = useFilmActions();
  // Each app's browse rows (new, acclaimed, genres...) load when it's
  // first opened; "loading" until they arrive, [] if they couldn't.
  const [moreRows, setMoreRows] = useState<Record<number, CouchService["rows"] | "loading">>({});
  const [moreFilms, setMoreFilms] = useState<Record<number, CouchFilm>>({});
  const films = useMemo(() => ({ ...moreFilms, ...data.films }), [moreFilms, data.films]);
  const servicesById = useMemo(
    () =>
      new Map(
        data.services.map((s) => {
          const more = moreRows[s.id];
          if (!Array.isArray(more)) return [s.id, s];
          // The watchlist row already shows these; don't repeat them below.
          const onWatchlist = new Set(s.rows[0]?.title === "On your watchlist" ? s.rows[0].ids : []);
          // Skip rows the personal feed already covers under the same name
          // (or, for short films, a different one).
          const titles = new Set(s.rows.map((r) => r.title));
          if (titles.has("Quick watches")) titles.add("Under 100 minutes");
          const extra = more
            .filter((r) => !titles.has(r.title))
            .map((r) => ({ title: r.title, ids: r.ids.filter((id) => !onWatchlist.has(id)) }))
            .filter((r) => r.ids.length >= 3);
          return [s.id, { ...s, rows: [...s.rows, ...extra] }];
        })
      ),
    [data.services, moreRows]
  );

  function loadMoreRows(serviceId: number) {
    if (moreRows[serviceId]) return;
    setMoreRows((m) => ({ ...m, [serviceId]: "loading" }));
    fetch(`/api/couch/service/${serviceId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { rows: CouchService["rows"]; films: Record<number, CouchFilm> }) => {
        setMoreFilms((f) => ({ ...body.films, ...f }));
        setMoreRows((m) => ({ ...m, [serviceId]: body.rows }));
      })
      .catch(() => setMoreRows((m) => ({ ...m, [serviceId]: [] })));
  }

  function go(next: Screen) {
    setHistory((h) => [...h, screen]);
    setScreen(next);
  }
  function back() {
    if (history.length === 0) return;
    setScreen(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  // Every screen change puts the highlight on its first item, so the
  // "remote" carries on from there. preventScroll: the page itself
  // shouldn't jump.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }, [screen]);

  // The arrow keys drive the TV even before you've clicked into it: with
  // nothing else focused, the first press lands on the TV's first item
  // instead of scrolling the page.
  useEffect(() => {
    function onWindowKey(e: KeyboardEvent) {
      const root = rootRef.current;
      if (!root || !remoteDirection(e)) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      e.preventDefault();
      root.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    }
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    const root = rootRef.current;
    if (!root) return;
    const dir = remoteDirection(e);
    if (dir) {
      e.preventDefault();
      moveFocus(root, dir);
    } else if ((e.key === "Escape" || e.key === "Backspace") && history.length > 0) {
      e.preventDefault();
      back();
    }
  }

  async function toggleWatchlist(film: CouchFilm) {
    const on = !watchlist.has(film.id);
    const set = (value: boolean) =>
      setWatchlist((prev) => {
        const next = new Set(prev);
        if (value) next.add(film.id);
        else next.delete(film.id);
        return next;
      });
    set(on);
    if (!(await actions.setWatchlist(film.id, on))) set(!on);
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      role="application"
      aria-roledescription="TV"
      aria-label="Flixtally TV. Use the arrow keys or W, A, S and D to move, Enter to choose and Escape to go back."
      className="relative h-full w-full overflow-hidden bg-[#06080d] text-white [font-size:max(9px,2.05cqw)]"
    >
      {screen.kind === "home" && (
        <HomeScreen
          data={data}
          username={username}
          onService={(id) => {
            loadMoreRows(id);
            go({ kind: "service", serviceId: id });
          }}
          onFilm={(id) => go({ kind: "film", filmId: id, serviceId: null })}
        />
      )}
      {screen.kind === "service" && servicesById.get(screen.serviceId) && (
        <ServiceScreen
          service={servicesById.get(screen.serviceId)!}
          films={films}
          loadingMore={moreRows[screen.serviceId] === "loading"}
          focusedFilm={focusedFilm}
          onFocusFilm={setFocusedFilm}
          onBack={back}
          onFilm={(id) => go({ kind: "film", filmId: id, serviceId: screen.serviceId })}
        />
      )}
      {screen.kind === "film" && films[screen.filmId] && (
        <FilmScreen
          key={screen.filmId}
          film={films[screen.filmId]}
          service={
            servicesById.get(screen.serviceId ?? -1) ??
            films[screen.filmId].providerIds.map((id) => servicesById.get(id)).find(Boolean) ??
            null
          }
          inWatchlist={watchlist.has(screen.filmId)}
          onWatchlist={() => toggleWatchlist(films[screen.filmId])}
          onBack={back}
        />
      )}
    </div>
  );
}

function TopBar({ left }: { left: ReactNode }) {
  const time = useSyncExternalStore(subscribeClock, clockText, () => "");
  return (
    <div className="flex items-center justify-between text-[0.85em] text-white/70">
      {left}
      <span suppressHydrationWarning className="tabular-nums">
        {time}
      </span>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      data-tv
      onClick={onBack}
      className={`flex items-center gap-[0.3em] rounded-full bg-white/10 px-[0.7em] py-[0.25em] text-white/90 ${focusRing}`}
    >
      <ArrowLeft aria-hidden className="h-[1em] w-[1em]" />
      Back
    </button>
  );
}

function ServiceLogo({ service, size }: { service: CouchService; size: string }) {
  const src = logoUrl(service.logoPath, "w154");
  return src ? (
    <Image
      src={src}
      alt=""
      width={154}
      height={154}
      sizes="10vw"
      className="rounded-[18%] object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex items-center justify-center rounded-[18%] bg-white/10 font-bold"
      style={{ width: size, height: size }}
    >
      {service.name.slice(0, 1)}
    </span>
  );
}

function PosterButton({
  film,
  onSelect,
  onFocus,
}: {
  film: CouchFilm;
  onSelect: () => void;
  onFocus?: () => void;
}) {
  const src = posterUrl(film.posterPath, "w200");
  return (
    <button
      type="button"
      data-tv
      onClick={onSelect}
      onFocus={onFocus}
      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
      aria-label={film.title}
      className={`relative aspect-[2/3] w-[5.2em] shrink-0 overflow-hidden rounded-[0.35em] bg-white/5 ${focusRing}`}
    >
      {src ? (
        <Image src={src} alt="" fill sizes="12vw" className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-[0.4em] text-center text-[0.7em]">
          {film.title}
        </span>
      )}
    </button>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-[0.9em]">
      <h3 className="mb-[0.45em] text-[0.85em] font-semibold text-white/85">{title}</h3>
      <div className="no-scrollbar -mx-[1.6em] flex gap-[0.7em] overflow-x-auto px-[1.6em] py-[0.35em]">
        {children}
      </div>
    </section>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Late night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function HomeScreen({
  data,
  username,
  onService,
  onFilm,
}: {
  data: CouchData;
  username: string;
  onService: (id: number) => void;
  onFilm: (id: number) => void;
}) {
  const hello = useSyncExternalStore(subscribeClock, greeting, () => "Hello");
  const picks = data.picks.map((id) => data.films[id]).filter(Boolean);
  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-[radial-gradient(120%_90%_at_20%_0%,#18233d_0%,#06080d_60%)] p-[1.6em]">
      <TopBar
        left={
          <span className="font-[family-name:var(--font-display)] font-bold tracking-tight text-white">
            Flix<span className="text-accent-green">tally</span> TV
          </span>
        }
      />
      <div className="mt-[1em]">
        <p className="text-[0.8em] uppercase tracking-[0.14em] text-white/55" suppressHydrationWarning>
          {hello}, {username}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[1.8em] font-bold leading-tight">
          What are we watching?
        </h2>
      </div>

      {/* One row of every service on the account; it scrolls sideways
          when there are more than fit, following the highlight. */}
      <Row title={`Your apps · ${data.services.length}`}>
          {data.services.map((s) => (
          <button
            key={s.id}
            type="button"
            data-tv
            onClick={() => onService(s.id)}
            onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
            className={`flex aspect-video w-[8.4em] shrink-0 flex-col items-center justify-center gap-[0.35em] rounded-[0.5em] bg-white/[0.07] ring-1 ring-white/10 ${focusRing}`}
          >
            <ServiceLogo service={s} size="2.4em" />
            <span className="max-w-full truncate px-[0.4em] text-[0.7em] text-white/80">{s.name}</span>
          </button>
          ))}
      </Row>

      {picks.length > 0 && (
        <Row title="Picked for you">
          {picks.map((film) => (
            <PosterButton key={film.id} film={film} onSelect={() => onFilm(film.id)} />
          ))}
        </Row>
      )}
    </div>
  );
}

function ServiceScreen({
  service,
  films,
  loadingMore,
  focusedFilm,
  onFocusFilm,
  onBack,
  onFilm,
}: {
  service: CouchService;
  films: Record<number, CouchFilm>;
  loadingMore: boolean;
  focusedFilm: number | null;
  onFocusFilm: (id: number) => void;
  onBack: () => void;
  onFilm: (id: number) => void;
}) {
  const firstId = service.rows[0]?.ids[0] ?? null;
  const hero = films[focusedFilm ?? -1] && service.rows.some((r) => r.ids.includes(focusedFilm!))
    ? films[focusedFilm!]
    : firstId != null
      ? films[firstId]
      : null;
  const backdrop = backdropUrl(hero?.backdropPath ?? null, "w780");

  return (
    <div className="relative h-full">
      {backdrop && (
        <Image
          key={backdrop}
          src={backdrop}
          alt=""
          fill
          sizes="50vw"
          className="animate-fade-in object-cover object-top opacity-60"
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#06080d_15%,rgba(6,8,13,0.55)_55%,rgba(6,8,13,0.2)),linear-gradient(0deg,#06080d_35%,transparent_75%)]" />
      <div className="no-scrollbar relative h-full overflow-y-auto p-[1.6em]">
        <TopBar
          left={
            <span className="flex items-center gap-[0.6em]">
              <BackButton onBack={onBack} />
              <ServiceLogo service={service} size="1.6em" />
              <span className="font-semibold text-white">{service.name}</span>
            </span>
          }
        />
        <div className="mt-[1.4em] min-h-[3.6em] max-w-[60%]">
          {hero && (
            <>
              <h2 className="line-clamp-2 font-[family-name:var(--font-display)] text-[1.7em] font-bold leading-tight">
                {hero.title}
              </h2>
              {hero.year && <p className="text-[0.8em] text-white/60">{hero.year}</p>}
            </>
          )}
        </div>
        {service.rows.length === 0 && !loadingMore ? (
          <p className="mt-[1.5em] text-[0.9em] text-white/70">
            Nothing picked for you here yet. Rate a few films and check back.
          </p>
        ) : (
          service.rows.map((row) => (
            <Row key={row.title} title={row.title}>
              {row.ids.map((id) =>
                films[id] ? (
                  <PosterButton
                    key={id}
                    film={films[id]}
                    onFocus={() => onFocusFilm(id)}
                    onSelect={() => onFilm(id)}
                  />
                ) : null
              )}
            </Row>
          ))
        )}
        {loadingMore && (
          <div aria-label="Loading more rows" className="mt-[1.2em]">
            <div className="mb-[0.5em] h-[0.8em] w-[8em] animate-pulse rounded bg-white/10" />
            <div className="flex gap-[0.6em]">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="aspect-[2/3] w-[5.2em] shrink-0 animate-pulse rounded-[0.35em] bg-white/10" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

function FilmScreen({
  film,
  service,
  inWatchlist,
  onWatchlist,
  onBack,
}: {
  film: CouchFilm;
  service: CouchService | null;
  inWatchlist: boolean;
  onWatchlist: () => void;
  onBack: () => void;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/discover/spotlight/${film.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Details | null) => !cancelled && d && setDetails(d))
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [film.id]);

  if (playing && details?.trailerKey) {
    return (
      <div className="relative h-full bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(details.trailerKey)}?autoplay=1&rel=0`}
          title={`${film.title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
        <div className="absolute left-[1em] top-[1em]">
          <BackButton onBack={() => setPlaying(false)} />
        </div>
      </div>
    );
  }

  const backdrop = backdropUrl(film.backdropPath, "w1280");
  const link = service ? watchLink(service, film.title, details?.watchLink ?? null) : null;
  const facts = [film.year, formatRuntime(details?.runtime ?? null), details?.genres.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative h-full">
      {backdrop && <Image src={backdrop} alt="" fill sizes="50vw" className="animate-fade-in object-cover" />}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#06080d_20%,rgba(6,8,13,0.7)_50%,rgba(6,8,13,0.1)),linear-gradient(0deg,#06080d_5%,transparent_45%)]" />
      <div className="relative flex h-full flex-col p-[1.6em]">
        <TopBar left={<BackButton onBack={onBack} />} />
        <div className="mt-auto max-w-[62%]">
          {service && (
            <p className="mb-[0.4em] flex items-center gap-[0.4em] text-[0.75em] text-white/75">
              <ServiceLogo service={service} size="1.4em" />
              On {service.name}
            </p>
          )}
          <h2 className="line-clamp-2 font-[family-name:var(--font-display)] text-[2em] font-bold leading-[1.05]">
            {film.title}
          </h2>
          {facts && <p className="mt-[0.3em] text-[0.8em] text-white/65">{facts}</p>}
          {details?.overview && (
            <p className="mt-[0.5em] line-clamp-3 text-[0.78em] leading-snug text-white/80">{details.overview}</p>
          )}
          <div className="mt-[0.9em] flex flex-wrap gap-[0.5em]">
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                data-tv
                className={`flex items-center gap-[0.4em] rounded-[0.35em] bg-white px-[0.9em] py-[0.45em] text-[0.85em] font-semibold text-black ${focusRing}`}
              >
                <Play aria-hidden className="h-[1em] w-[1em] fill-current" />
                {link.direct ? `Watch on ${link.label}` : `Find it on ${link.label}`}
                <ExternalLink aria-hidden className="h-[0.85em] w-[0.85em] opacity-60" />
              </a>
            )}
            {details?.trailerKey && (
              <button
                type="button"
                data-tv
                onClick={() => setPlaying(true)}
                className={`rounded-[0.35em] bg-white/15 px-[0.9em] py-[0.45em] text-[0.85em] font-semibold ${focusRing}`}
              >
                Trailer
              </button>
            )}
            <button
              type="button"
              data-tv
              onClick={onWatchlist}
              aria-pressed={inWatchlist}
              className={`flex items-center gap-[0.35em] rounded-[0.35em] px-[0.9em] py-[0.45em] text-[0.85em] font-semibold ${
                inWatchlist ? "bg-accent-green text-black" : "bg-white/15"
              } ${focusRing}`}
            >
              <Bookmark aria-hidden className={`h-[1em] w-[1em] ${inWatchlist ? "fill-current" : ""}`} />
              {inWatchlist ? "On watchlist" : "Watchlist"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
