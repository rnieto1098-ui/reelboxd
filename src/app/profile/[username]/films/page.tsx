import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getWatchedTmdbIds } from "@/lib/recommendations";
import { MovieCard } from "@/components/MovieCard";
import { SortChips } from "@/components/SortChips";
import { Pagination } from "@/components/Pagination";
import {
  FILM_SORTS,
  STAR_VALUES,
  filmsHref,
  formatStars,
  parseFilmsParams,
  sortFilms,
  type FilmRow,
  type FilmSortKey,
  type FilmsParams,
  type SortDir,
} from "@/lib/profileFilms";
import { EmptyState } from "@/components/EmptyState";

// Every film someone has rated (or, under "Not rated", logged or marked
// watched without a rating): the profile's Recently logged row stops at 60,
// and the diary lists watches, not films.

const PAGE_SIZE = 60;

export async function generateMetadata({ params }: PageProps<"/profile/[username]/films">): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s films` };
}

const MOVIE_SELECT = { tmdbId: true, title: true, posterPath: true, releaseDate: true } as const;

export default async function ProfileFilmsPage({
  params,
  searchParams,
}: PageProps<"/profile/[username]/films">) {
  const { username } = await params;
  const query: FilmsParams = parseFilmsParams(await searchParams);
  const session = await auth();
  const viewerId = session?.user?.id;

  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (!user) notFound();
  const userId = user.id;

  const [histogram, ratedCount] = await Promise.all([
    prisma.rating.groupBy({ by: ["score"], where: { userId }, _count: { _all: true } }),
    prisma.rating.count({ where: { userId } }),
  ]);
  const countByStars = new Map(histogram.map((h) => [h.score, h._count._all]));

  let rows: FilmRow[];
  let total: number;

  if (query.stars === "unrated") {
    // Seen but never rated: logged in the diary or marked watched, with no
    // rating. Small enough per user to merge in memory.
    const [ratedIds, diary, watched] = await Promise.all([
      prisma.rating.findMany({ where: { userId }, select: { movieId: true } }),
      prisma.diaryEntry.findMany({
        where: { userId },
        select: { movieId: true, watchedDate: true, movie: { select: MOVIE_SELECT } },
        orderBy: { watchedDate: "desc" },
      }),
      prisma.watchedItem.findMany({
        where: { userId },
        select: { movieId: true, addedAt: true, movie: { select: MOVIE_SELECT } },
      }),
    ]);
    const rated = new Set(ratedIds.map((r) => r.movieId));
    const byMovie = new Map<string, FilmRow>();
    for (const d of diary) {
      if (rated.has(d.movieId) || byMovie.has(d.movieId)) continue;
      byMovie.set(d.movieId, { ...d.movie, score: null, at: d.watchedDate });
    }
    for (const w of watched) {
      if (rated.has(w.movieId) || byMovie.has(w.movieId)) continue;
      byMovie.set(w.movieId, { ...w.movie, score: null, at: w.addedAt });
    }
    const all = sortFilms([...byMovie.values()], query.sort, query.dir);
    total = all.length;
    rows = all.slice((query.page - 1) * PAGE_SIZE, query.page * PAGE_SIZE);
  } else {
    const where = { userId, ...(query.stars != null ? { score: query.stars } : {}) };
    const dir = query.dir;
    const orderBy =
      query.sort === "rating"
        ? [{ score: dir }, { updatedAt: "desc" as const }]
        : query.sort === "release"
          ? [{ movie: { releaseDate: dir } }]
          : query.sort === "title"
            ? [{ movie: { title: dir } }]
            : [{ updatedAt: dir }];
    const [ratings, count] = await Promise.all([
      prisma.rating.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { score: true, updatedAt: true, movie: { select: MOVIE_SELECT } },
      }),
      prisma.rating.count({ where }),
    ]);
    rows = ratings.map((r) => ({ ...r.movie, score: r.score, at: r.updatedAt }));
    total = count;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const [posterOverrides, owned, watchlist, viewerWatched] = await Promise.all([
    getCustomPosterMap(viewerId, rows.map((r) => r.tmdbId)),
    getUserOwnedTmdbIds(viewerId),
    getUserWatchlistedTmdbIds(viewerId),
    getWatchedTmdbIds(viewerId),
  ]);

  const href = (overrides: Partial<FilmsParams>) => filmsHref(username, { ...query, ...overrides });
  const chip = (active: boolean) =>
    `chip pointer-coarse:px-3 pointer-coarse:py-1.5 ${active ? "chip-active" : "hover:border-foreground/40 hover:text-foreground"}`;
  const isOwnProfile = viewerId === userId;

  return (
    <div>
      <Link href={`/profile/${username}`} className="text-sm text-muted hover:text-foreground hover:underline">
        ← {username}
      </Link>
      <h1 className="page-title mt-1">{isOwnProfile ? "Your films" : `${username}'s films`}</h1>
      <p className="mb-6 text-sm text-muted">
        {ratedCount} film{ratedCount === 1 ? "" : "s"} rated
      </p>

      <nav aria-label="Filter by rating" className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={href({ stars: null, page: 1 })} className={chip(query.stars == null)}>
          All rated
        </Link>
        {STAR_VALUES.filter((s) => countByStars.has(s)).map((s) => (
          <Link key={s} href={href({ stars: s, page: 1 })} className={chip(query.stars === s)}>
            {formatStars(s)}
            <span className="opacity-60">{countByStars.get(s)}</span>
          </Link>
        ))}
        <Link href={href({ stars: "unrated", page: 1 })} className={chip(query.stars === "unrated")}>
          Not rated
        </Link>
      </nav>
      <div className="mb-6">
        <SortChips
          options={(Object.keys(FILM_SORTS) as FilmSortKey[])
            .filter((key) => !(query.stars === "unrated" && key === "rating"))
            .map((key) => ({
              key,
              label: query.stars === "unrated" && key === "rated" ? "Date seen" : FILM_SORTS[key].label,
            }))}
          activeKey={query.sort}
          activeDir={query.dir}
          hrefFor={(key: FilmSortKey, nextDir: SortDir) =>
            href({ sort: key, dir: key === "title" && key !== query.sort ? "asc" : nextDir, page: 1 })
          }
        />
      </div>

      {rows.length === 0 && total === 0 && query.stars == null ? (
        <EmptyState
          art="ratings"
          title={isOwnProfile ? "You haven't rated any films yet" : `${username} hasn't rated any films yet`}
        >
          {isOwnProfile ? "Rate a film from its page and it lands here, with your stars." : null}
        </EmptyState>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">
          {total > 0
            ? "Nothing on this page. Try going back."
            : query.stars === "unrated"
              ? "Every film seen has a rating."
              : query.stars != null
                ? `No films rated ${formatStars(query.stars)}.`
                : isOwnProfile
                  ? "You haven't rated any films yet."
                  : `${username} hasn't rated any films yet.`}
        </p>
      ) : (
        <div className="poster-grid">
          {rows.map((film, i) => (
            <div key={film.tmdbId}>
              <MovieCard
                tmdbId={film.tmdbId}
                title={film.title}
                posterPath={posterOverrides.get(film.tmdbId) ?? film.posterPath}
                year={film.releaseDate?.slice(0, 4)}
                owned={owned.has(film.tmdbId)}
                inWatchlist={watchlist.has(film.tmdbId)}
                watched={viewerWatched.has(film.tmdbId)}
                priority={i < 6}
              />
              <p className="mt-1 text-xs text-accent-green" aria-label={film.score != null ? `Rated ${film.score} out of 5` : "Seen, not rated"}>
                {film.score != null ? formatStars(film.score) : <span className="text-subtle">Seen</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <Pagination page={query.page} totalPages={totalPages} hrefFor={(page) => href({ page })} />
    </div>
  );
}
