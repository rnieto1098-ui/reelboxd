import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { CalendarDays, Clock, Star } from "lucide-react";
import { PosterImage } from "@/components/PosterImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getMovieDetails,
  getSimilarMovies,
  getUsCertification,
  pickTrailer,
  posterUrl,
  backdropUrl,
  logoUrl,
  type TmdbWatchProvider,
} from "@/lib/tmdb";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserProviderIds, getWatchAvailability } from "@/lib/streaming";
import { excludeShortFilms } from "@/lib/runtimeFilter";
import { formatRuntime } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { WatchlistButton } from "@/components/WatchlistButton";
import { RewatchButton } from "@/components/RewatchButton";
import { LikeButton } from "@/components/LikeButton";
import { OwnedButton } from "@/components/OwnedButton";
import { WatchedButton } from "@/components/WatchedButton";
import { LogWatchButton } from "@/components/LogWatchButton";
import { CastList } from "@/components/CastList";
import { PosterPicker } from "@/components/PosterPicker";
import { AboutMovieModal } from "@/components/AboutMovieModal";
import { AddToListButton } from "@/components/AddToListButton";
import { MovieListsButton } from "@/components/MovieListsButton";
import { ContentAdvisoryModal } from "@/components/ContentAdvisoryModal";
import { MovieRow } from "@/components/MovieRow";
import { TrailerButton } from "@/components/TrailerButton";
import { HomeRowsSkeleton } from "@/components/HomeRowsSkeleton";

// How many of the billed cast get a portrait card. The full cast is in the
// credits dialog.
const CAST_CARD_COUNT = 20;
// Below this many votes a TMDB average says little, so none is shown.
const MIN_VOTES_FOR_SCORE = 20;

// Next dedupes this against the identical getMovieDetails(tmdbId) call the
// page component below makes — both run within the same request, so this
// doesn't cost a second TMDB fetch.
export async function generateMetadata({
  params,
}: PageProps<"/movie/[tmdbId]">): Promise<Metadata> {
  const { tmdbId: tmdbIdParam } = await params;
  const tmdbId = Number(tmdbIdParam);
  if (!Number.isFinite(tmdbId)) return {};

  const details = await getMovieDetails(tmdbId).catch(() => null);
  if (!details) return {};

  const year = details.release_date?.slice(0, 4);
  const title = year ? `${details.title} (${year})` : details.title;
  const description = details.overview || `${details.title} on Flixtally.`;
  const poster = posterUrl(details.poster_path, "w500");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "video.movie",
      images: poster ? [{ url: poster, width: 500, height: 750 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: poster ? [poster] : undefined,
    },
  };
}

export default async function MovieDetailPage({
  params,
}: PageProps<"/movie/[tmdbId]">) {
  const { tmdbId: tmdbIdParam } = await params;
  const tmdbId = Number(tmdbIdParam);
  if (!Number.isFinite(tmdbId)) notFound();

  const [details, session] = await Promise.all([
    getMovieDetails(tmdbId).catch(() => null),
    auth(),
  ]);

  if (!details) notFound();

  const [
    localMovie,
    watchAvailability,
    userProviderIds,
    myLists,
    listsContainingMovie,
    avgRating,
  ] = await Promise.all([
      prisma.movie.findUnique({
        where: { tmdbId },
        include: {
          ratings: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          watchlist: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          rewatchList: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          likes: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          owned: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          watched: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          diaryEntries: session?.user?.id
            ? { where: { userId: session.user.id }, orderBy: { watchedDate: "desc" } }
            : false,
          _count: { select: { likes: true } },
        },
      }),
      getWatchAvailability(tmdbId),
      getUserProviderIds(session?.user?.id),
      session?.user?.id
        ? prisma.list.findMany({
            where: { ownerId: session.user.id },
            orderBy: { createdAt: "desc" },
            include: { items: { where: { tmdbId }, select: { id: true } } },
          })
        : Promise.resolve([]),
      // Every list this movie is actually on — Flixtally's curated system
      // lists (Best Picture, Top 250, etc.) plus the viewer's own, so the
      // "Lists" button under the poster isn't limited to lists they made.
      prisma.list.findMany({
        where: {
          items: { some: { tmdbId } },
          OR: [{ isSystem: true }, ...(session?.user?.id ? [{ ownerId: session.user.id }] : [])],
        },
        orderBy: [{ isSystem: "desc" }, { title: "asc" }],
        select: { id: true, title: true, isSystem: true },
      }),
      // Filtered by the relation rather than a local Movie id so this can run
      // alongside the query above instead of waiting on it to resolve first.
      prisma.rating.aggregate({
        where: { movie: { tmdbId } },
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);

  const posterOverrides = await getCustomPosterMap(session?.user?.id, [tmdbId]);
  const customPosterPath = posterOverrides.get(tmdbId) ?? null;

  const myRating = localMovie?.ratings?.[0]?.score ?? null;
  const inWatchlist = (localMovie?.watchlist?.length ?? 0) > 0;
  const inRewatch = (localMovie?.rewatchList?.length ?? 0) > 0;
  const isLiked = (localMovie?.likes?.length ?? 0) > 0;
  const likeCount = localMovie?._count.likes ?? 0;
  const isOwned = (localMovie?.owned?.length ?? 0) > 0;
  // Lit for any of the three ways the app knows you've seen a film, so it
  // can't sit unlit next to a diary entry saying you watched it twice.
  const isWatched =
    (localMovie?.watched?.length ?? 0) > 0 ||
    (localMovie?.diaryEntries?.length ?? 0) > 0 ||
    myRating != null;
  const diaryEntries = localMovie?.diaryEntries ?? [];

  const flatrateProviders = watchAvailability.flatrate ?? [];
  const rentBuyProviders = [
    ...(watchAvailability.rent ?? []),
    ...(watchAvailability.buy ?? []),
  ].filter(
    (p, i, arr) => arr.findIndex((other) => other.provider_id === p.provider_id) === i
  );

  const backdrop = backdropUrl(details.backdrop_path);
  const poster = posterUrl(customPosterPath ?? details.poster_path, "w500");
  const year = details.release_date?.slice(0, 4);
  const directors = details.credits?.crew.filter((c) => c.job === "Director") ?? [];
  const cast = details.credits?.cast ?? [];
  const runtime = formatRuntime(details.runtime);
  const certification = getUsCertification(details);
  const keywordNames = details.keywords?.keywords.map((k) => k.name) ?? [];
  const trailer = pickTrailer(details);
  const signedIn = !!session?.user;
  const tmdbScore =
    (details.vote_count ?? 0) >= MIN_VOTES_FOR_SCORE && details.vote_average > 0
      ? details.vote_average
      : null;
  const releaseDate = details.release_date
    ? new Date(`${details.release_date}T00:00:00.000Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
  const lastLogged = diaryEntries[0]?.watchedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      {/* Hero: the film's still across the full window, with the poster,
          title and main actions over it. */}
      <section className="bleed relative -mt-8 overflow-hidden bg-surface">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover object-[center_20%] opacity-60"
          />
        )}
        <div aria-hidden className="scrim-left absolute inset-0" />
        <div aria-hidden className="scrim-bottom absolute inset-0" />

        <div className="container-page relative grid grid-cols-[minmax(0,1fr)] items-end gap-6 pb-10 pt-16 sm:gap-10 sm:pt-28 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] lg:pt-36">
          <div className="mx-auto w-44 sm:w-56 md:mx-0 md:w-full">
            {/* PosterImage covers both a missing poster_path and one that 404s
                when fetched, with the same title-card placeholder as the rows. */}
            <div className="aspect-[2/3] overflow-hidden rounded-xl bg-surface shadow-pop ring-1 ring-white/15">
              <PosterImage
                src={poster}
                alt={`${details.title} poster`}
                year={year}
                quality={90}
                sizes="(min-width: 1024px) 280px, (min-width: 768px) 240px, 224px"
                priority
              />
            </div>
          </div>

          <div className="min-w-0 text-center md:text-left">
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-foreground/85 md:justify-start">
              {certification && (
                <span className="rounded border border-white/40 px-1.5 py-0.5 font-semibold">
                  {certification}
                </span>
              )}
              {year && (
                <span className="flex items-center gap-1">
                  <CalendarDays aria-hidden className="h-3.5 w-3.5" />
                  {year}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1">
                  <Clock aria-hidden className="h-3.5 w-3.5" />
                  {runtime}
                </span>
              )}
              {tmdbScore != null && (
                <span
                  className="flex items-center gap-1 text-accent-gold"
                  title={`${details.vote_count?.toLocaleString("en-US")} ratings on TMDB`}
                >
                  <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
                  {tmdbScore.toFixed(1)}
                  <span className="text-foreground/60">TMDB</span>
                </span>
              )}
            </div>

            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
              {details.title}
            </h1>
            {details.tagline && (
              <p className="mt-3 text-lg italic text-foreground/75">{details.tagline}</p>
            )}
            {directors.length > 0 && (
              <p className="mt-3 text-sm text-foreground/75">
                Directed by{" "}
                {directors.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    <Link
                      href={`/crew/person/${d.id}`}
                      className="font-semibold text-foreground hover:text-accent-green hover:underline"
                    >
                      {d.name}
                    </Link>
                  </span>
                ))}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
              {trailer && <TrailerButton videoKey={trailer.key} title={details.title} />}
              <WatchlistButton
                tmdbId={tmdbId}
                initialInWatchlist={inWatchlist}
                signedIn={signedIn}
              />
              <LogWatchButton tmdbId={tmdbId} signedIn={signedIn} />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          {/* Everything the viewer has said about this film, in one place. */}
          <section className="card p-5" aria-label="Your activity">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <StarRating tmdbId={tmdbId} initialScore={myRating} signedIn={signedIn} />
              {avgRating._avg.score != null && (
                <p className="text-sm text-muted">
                  Flixtally members:{" "}
                  <span className="font-semibold text-foreground">
                    {avgRating._avg.score.toFixed(1)}
                  </span>{" "}
                  / 5 from {avgRating._count.score} rating{avgRating._count.score === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <WatchedButton tmdbId={tmdbId} initialWatched={isWatched} signedIn={signedIn} />
              <LikeButton
                tmdbId={tmdbId}
                initialLiked={isLiked}
                likeCount={likeCount}
                signedIn={signedIn}
              />
              <OwnedButton tmdbId={tmdbId} initialOwned={isOwned} signedIn={signedIn} />
              <RewatchButton tmdbId={tmdbId} initialInRewatch={inRewatch} signedIn={signedIn} />
              {session?.user && (
                <AddToListButton
                  tmdbId={tmdbId}
                  title={details.title}
                  posterPath={details.poster_path}
                  releaseDate={details.release_date}
                  lists={myLists.map((l) => ({
                    id: l.id,
                    title: l.title,
                    hasMovie: l.items.length > 0,
                  }))}
                />
              )}
            </div>
            {diaryEntries.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                In your diary {diaryEntries.length} time{diaryEntries.length === 1 ? "" : "s"}, most
                recently {lastLogged}.
              </p>
            )}
          </section>

          {details.overview && (
            <section>
              <h2 className="section-title mb-3">Overview</h2>
              <p className="max-w-3xl text-[15px] leading-relaxed text-foreground/85">
                {details.overview}
              </p>
            </section>
          )}

          {cast.length > 0 && (
            <CastList
              cast={cast.slice(0, CAST_CARD_COUNT).map((c) => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profile_path: c.profile_path,
              }))}
            />
          )}
        </div>

        <aside className="space-y-5">
          <WhereToWatch
            flatrate={flatrateProviders}
            rentBuy={rentBuyProviders}
            userProviderIds={userProviderIds}
          />

          <section className="card p-5">
            <h2 className="mb-3 font-sans text-sm font-semibold tracking-normal">Details</h2>
            <dl className="space-y-3 text-sm">
              {releaseDate && (
                <div>
                  <dt className="text-xs text-subtle">Release date</dt>
                  <dd>{releaseDate}</dd>
                </div>
              )}
              {runtime && (
                <div>
                  <dt className="text-xs text-subtle">Runtime</dt>
                  <dd>{runtime}</dd>
                </div>
              )}
              {details.genres.length > 0 && (
                <div>
                  <dt className="mb-1.5 text-xs text-subtle">Genres</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {details.genres.map((g) => (
                      <span key={g.id} className="chip">
                        {g.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
            <div className="-mx-2 mt-4 flex flex-col items-start border-t border-border pt-3">
              <AboutMovieModal
                title={details.title}
                genres={details.genres}
                studios={(details.production_companies ?? []).map((c) => ({
                  id: c.id,
                  name: c.name,
                  logo_path: c.logo_path,
                }))}
                crew={(details.credits?.crew ?? []).map((c) => ({
                  id: c.id,
                  name: c.name,
                  job: c.job,
                  department: c.department,
                }))}
                cast={cast.map((c) => ({
                  id: c.id,
                  name: c.name,
                  character: c.character,
                  profile_path: c.profile_path,
                }))}
              />
              <MovieListsButton
                lists={listsContainingMovie.map((l) => ({
                  id: l.id,
                  title: l.title,
                  isSystem: l.isSystem,
                }))}
              />
              {session?.user && (
                <PosterPicker tmdbId={tmdbId} hasCustomPoster={!!customPosterPath} />
              )}
              <ContentAdvisoryModal certification={certification} keywords={keywordNames} />
            </div>
          </section>
        </aside>
      </div>

      {/* Streams in after the rest: it needs a TMDB call plus a runtime
          lookup per film, and nothing above depends on it. */}
      <div className="mt-12">
        <Suspense fallback={<HomeRowsSkeleton rows={1} />}>
          <SimilarRow tmdbId={tmdbId} userId={session?.user?.id} />
        </Suspense>
      </div>
    </div>
  );
}

function WhereToWatch({
  flatrate,
  rentBuy,
  userProviderIds,
}: {
  flatrate: TmdbWatchProvider[];
  rentBuy: TmdbWatchProvider[];
  userProviderIds: Set<number>;
}) {
  const providers = flatrate.length > 0 ? flatrate : rentBuy;
  const onYours = flatrate.filter((p) => userProviderIds.has(p.provider_id));

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-sans text-sm font-semibold tracking-normal">Where to watch</h2>
      {providers.length === 0 ? (
        <p className="text-sm text-muted">
          Not available to stream, rent or buy in the US right now.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            {flatrate.length === 0
              ? "Not on any subscription service right now. Rent or buy from:"
              : onYours.length > 0
                ? `Included with ${onYours.map((p) => p.provider_name).join(", ")}.`
                : "Streaming with a subscription on:"}
          </p>
          <ul className="flex flex-wrap gap-2.5">
            {providers.map((p) => {
              const logo = logoUrl(p.logo_path, "w92");
              const yours = flatrate.length > 0 && userProviderIds.has(p.provider_id);
              return (
                <li
                  key={p.provider_id}
                  title={yours ? `${p.provider_name} (one of your services)` : p.provider_name}
                  className={`relative h-12 w-12 overflow-hidden rounded-xl bg-surface-hover ${
                    yours ? "ring-2 ring-accent-green" : "ring-1 ring-white/10"
                  }`}
                >
                  {logo ? (
                    <Image src={logo} alt={p.provider_name} width={48} height={48} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                      {p.provider_name[0]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Link
        href="/streaming"
        className="mt-3 inline-block text-xs text-muted hover:text-accent-green hover:underline"
      >
        {userProviderIds.size > 0 ? "Edit your services" : "Add your streaming services"}
      </Link>
    </section>
  );
}

// "More like this" is a recommendation like any other row — same app-wide
// minimum-runtime rule applies (see runtimeFilter.ts).
async function SimilarRow({ tmdbId, userId }: { tmdbId: number; userId: string | undefined }) {
  const similar = await getSimilarMovies(tmdbId).catch(() => ({ results: [] }));
  const filtered = (await excludeShortFilms(similar.results)).slice(0, 18);
  if (filtered.length === 0) return null;
  const posterOverrides = await getCustomPosterMap(
    userId,
    filtered.map((m) => m.id)
  );
  return <MovieRow title="More like this" movies={applyPosterOverrides(filtered, posterOverrides)} />;
}
