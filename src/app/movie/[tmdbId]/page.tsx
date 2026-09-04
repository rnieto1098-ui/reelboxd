import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getMovieDetails,
  getSimilarMovies,
  getUsCertification,
  posterUrl,
  backdropUrl,
  logoUrl,
} from "@/lib/tmdb";
import { applyPosterOverrides, getCustomPosterMap } from "@/lib/customPosters";
import { getUserProviderIds, getWatchAvailability } from "@/lib/streaming";
import { excludeShortFilms } from "@/lib/runtimeFilter";
import { formatRuntime } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { WatchlistButton } from "@/components/WatchlistButton";
import { LikeButton } from "@/components/LikeButton";
import { OwnedButton } from "@/components/OwnedButton";
import { LogWatchButton } from "@/components/LogWatchButton";
import { CastList } from "@/components/CastList";
import { PosterPicker } from "@/components/PosterPicker";
import { AboutMovieModal } from "@/components/AboutMovieModal";
import { AddToListButton } from "@/components/AddToListButton";
import { ContentAdvisoryModal } from "@/components/ContentAdvisoryModal";
import { MovieRow } from "@/components/MovieRow";

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

  const [localMovie, watchAvailability, userProviderIds, similar, myLists, avgRating] =
    await Promise.all([
      prisma.movie.findUnique({
        where: { tmdbId },
        include: {
          ratings: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          watchlist: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          likes: session?.user?.id
            ? { where: { userId: session.user.id } }
            : false,
          owned: session?.user?.id
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
      getSimilarMovies(tmdbId).catch(() => ({ results: [] })),
      session?.user?.id
        ? prisma.list.findMany({
            where: { ownerId: session.user.id },
            orderBy: { createdAt: "desc" },
            include: { items: { where: { tmdbId }, select: { id: true } } },
          })
        : Promise.resolve([]),
      // Filtered by the relation rather than a local Movie id so this can run
      // alongside the query above instead of waiting on it to resolve first.
      prisma.rating.aggregate({
        where: { movie: { tmdbId } },
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);

  // "More like this" is a recommendation like any other row — same
  // app-wide minimum-runtime rule applies (see runtimeFilter.ts).
  const similarFiltered = await excludeShortFilms(similar.results);

  // One combined lookup for both the primary movie's poster override and the
  // "More like this" row's, instead of two separate CustomPoster queries.
  const posterOverrides = await getCustomPosterMap(session?.user?.id, [
    tmdbId,
    ...similarFiltered.map((m) => m.id),
  ]);
  const customPosterPath = posterOverrides.get(tmdbId) ?? null;
  const similarMovies = applyPosterOverrides(similarFiltered.slice(0, 12), posterOverrides);

  const myRating = localMovie?.ratings?.[0]?.score ?? null;
  const inWatchlist = (localMovie?.watchlist?.length ?? 0) > 0;
  const isLiked = (localMovie?.likes?.length ?? 0) > 0;
  const likeCount = localMovie?._count.likes ?? 0;
  const isOwned = (localMovie?.owned?.length ?? 0) > 0;
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
  const director = details.credits?.crew.find((c) => c.job === "Director");
  const cast = details.credits?.cast ?? [];
  const runtime = formatRuntime(details.runtime);
  const certification = getUsCertification(details);
  const keywordNames = details.keywords?.keywords.map((k) => k.name) ?? [];

  return (
    <div>
      {backdrop && (
        <div className="relative -mx-4 mb-8 h-64 overflow-hidden sm:-mx-8 sm:h-80">
          <Image src={backdrop} alt="" fill className="object-cover opacity-30" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[240px_1fr] md:-mt-40 relative">
        <div className="w-40 sm:w-60 mx-auto md:mx-0">
          {poster ? (
            <Image
              src={poster}
              alt={details.title}
              width={500}
              height={750}
              className="rounded-lg border border-border shadow-lg"
            />
          ) : (
            <div className="aspect-[2/3] rounded-lg bg-surface border border-border" />
          )}
          <div className="mt-2 flex items-center justify-center gap-3 md:justify-start">
            {session?.user && (
              <PosterPicker tmdbId={tmdbId} hasCustomPoster={!!customPosterPath} />
            )}
            <AboutMovieModal
              title={details.title}
              genres={details.genres}
              studios={details.production_companies ?? []}
              crew={details.credits?.crew ?? []}
              cast={cast}
            />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold">
            {details.title} {year && <span className="font-normal text-muted">({year})</span>}
          </h1>
          {director && <p className="mt-1 text-muted">Directed by {director.name}</p>}
          {(runtime || certification) && (
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              {runtime && <span>{runtime}</span>}
              {certification && (
                <span className="rounded border border-border px-1.5 py-0.5 text-xs font-medium">
                  {certification}
                </span>
              )}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <StarRating tmdbId={tmdbId} initialScore={myRating} signedIn={!!session?.user} />
            <LikeButton
              tmdbId={tmdbId}
              initialLiked={isLiked}
              likeCount={likeCount}
              signedIn={!!session?.user}
            />
            <WatchlistButton
              tmdbId={tmdbId}
              initialInWatchlist={inWatchlist}
              signedIn={!!session?.user}
            />
            <OwnedButton tmdbId={tmdbId} initialOwned={isOwned} signedIn={!!session?.user} />
            <LogWatchButton tmdbId={tmdbId} signedIn={!!session?.user} />
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

          {avgRating._avg.score != null && (
            <p className="mt-2 text-sm text-muted">
              Average rating: {avgRating._avg.score.toFixed(1)} / 5 (
              {avgRating._count.score} rating{avgRating._count.score === 1 ? "" : "s"})
            </p>
          )}

          {diaryEntries.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              📅 Logged {diaryEntries.length} time{diaryEntries.length === 1 ? "" : "s"} · last on{" "}
              {diaryEntries[0].watchedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}

          {details.tagline && (
            <p className="mt-4 italic text-muted">{details.tagline}</p>
          )}
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">{details.overview}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {details.genres.map((g) => (
              <span key={g.id} className="rounded-full border border-border px-2 py-1">
                {g.name}
              </span>
            ))}
          </div>

          {flatrateProviders.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-muted">Where to watch</h3>
              <div className="flex flex-wrap gap-3">
                {flatrateProviders.map((p) => {
                  const logo = logoUrl(p.logo_path, "w92");
                  const owned = userProviderIds.has(p.provider_id);
                  return (
                    <div
                      key={p.provider_id}
                      title={p.provider_name}
                      className={`h-11 w-11 overflow-hidden rounded-lg border ${
                        owned ? "border-accent-green ring-1 ring-accent-green" : "border-border"
                      }`}
                    >
                      {logo && (
                        <Image src={logo} alt={p.provider_name} width={44} height={44} />
                      )}
                    </div>
                  );
                })}
              </div>
              <Link
                href="/streaming"
                className="mt-2 inline-block text-xs text-muted hover:text-accent-green hover:underline"
              >
                {userProviderIds.size > 0 ? "Edit your services" : "Add your streaming services"}
              </Link>
            </div>
          )}

          {flatrateProviders.length === 0 && rentBuyProviders.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-muted">Where to watch</h3>
              <p className="mb-2 text-xs text-muted">
                Not on any streaming service right now — available to rent or buy:
              </p>
              <div className="flex flex-wrap gap-3">
                {rentBuyProviders.map((p) => {
                  const logo = logoUrl(p.logo_path, "w92");
                  return (
                    <div
                      key={p.provider_id}
                      title={p.provider_name}
                      className="h-11 w-11 overflow-hidden rounded-lg border border-border"
                    >
                      {logo && (
                        <Image src={logo} alt={p.provider_name} width={44} height={44} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cast.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-muted">Cast</h3>
              <CastList cast={cast} />
            </div>
          )}

          <div className="mt-4">
            <ContentAdvisoryModal certification={certification} keywords={keywordNames} />
          </div>
        </div>
      </div>

      {similarMovies.length > 0 && (
        <div className="mt-10">
          <MovieRow title="More like this" movies={similarMovies} />
        </div>
      )}
    </div>
  );
}
