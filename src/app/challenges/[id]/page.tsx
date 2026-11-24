import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  filterMoviesByStreaming,
  getUserOwnedTmdbIds,
  getUserProviderIds,
  hasStreamingAvailability,
} from "@/lib/streaming";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { Check } from "lucide-react";
import { formatTimeLeft } from "@/lib/dates";
import { challengeStatus } from "@/lib/challengeStatus";
import { ProgressBar } from "@/components/Progress";
import {
  getChallengeSuggestions,
  getCrewFilmography,
  getWatchedAmong,
} from "@/lib/challenges";
import { CreditGrid, type CreditDisplay } from "@/components/CreditGrid";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";
import { MovieRow } from "@/components/MovieRow";
import { AvailabilityFilterLinks } from "@/components/AvailabilityFilterLinks";
import { AddAllToWatchlistButton } from "@/components/AddAllToWatchlistButton";
import { EditChallengeFilmsButton } from "@/components/EditChallengeFilmsButton";
import { ChallengeBadge, type BadgeKind } from "@/components/ChallengeBadge";

function buildHref(id: string, streamingOnly: boolean) {
  return streamingOnly ? `/challenges/${id}?streaming=1` : `/challenges/${id}`;
}

const TYPE_LABEL: Record<string, string> = {
  GENRE: "Genre challenge",
  TIMEFRAME: "Time frame challenge",
  CREW: "Crew challenge",
  LIST: "List challenge",
  CUSTOM: "Hand-picked challenge",
};

// Challenge types whose page shows a fixed set of films to work through,
// watched and not, rather than only the films already counted.
const SET_TYPES = new Set(["CREW", "LIST", "CUSTOM"]);

export default async function ChallengeDetailPage({
  params,
  searchParams,
}: PageProps<"/challenges/[id]">) {
  const { id } = await params;
  const { streaming } = await searchParams;
  const streamingOnly = streaming === "1";
  const session = await auth();
  const viewerId = session?.user?.id;

  // Public, like a profile page — anyone can look at a challenge, only the
  // owner sees edit/delete controls (those live on the /challenges list
  // page, not here). Progress is always computed against the challenge's
  // owner; owned/watchlist highlighting and "what to watch next" reflect
  // whoever is looking, same convention as the profile page.
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      user: { select: { username: true } },
      list: { select: { id: true, title: true } },
      films: { orderBy: { position: "asc" } },
    },
  });
  if (!challenge) notFound();
  const ownerId = challenge.userId;
  const isOwner = viewerId === ownerId;

  const [ownedIds, watchlistIds, suggestions, userProviderIds] = await Promise.all([
    getUserOwnedTmdbIds(viewerId),
    getUserWatchlistedTmdbIds(viewerId),
    viewerId ? getChallengeSuggestions(viewerId, challenge) : Promise.resolve([]),
    // Reflects whoever is looking, same as owned/watchlist above — the
    // question is "what can *this viewer* watch right now," regardless of
    // whose challenge it is.
    getUserProviderIds(viewerId),
  ]);

  let credits: CreditDisplay[];
  let target: number | null = challenge.target;
  let subtitle: string;
  // How many films count so far, for the progress bar in the header.
  let progressCount = 0;

  if (challenge.type === "CREW" && challenge.personId != null) {
    const filmography = await getCrewFilmography(challenge.personId, challenge.department);
    target = filmography.length;

    const watchedTmdbIds = await getWatchedAmong(
      ownerId,
      filmography.map((c) => c.id)
    );

    credits = filmography
      .slice()
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .map((credit) => ({
        id: credit.id,
        title: credit.title,
        posterPath: credit.poster_path,
        year: credit.release_date?.slice(0, 4),
        owned: ownedIds.has(credit.id),
        inWatchlist: watchlistIds.has(credit.id),
        watched: watchedTmdbIds.has(credit.id),
      }));
    progressCount = watchedTmdbIds.size;
    subtitle = `${watchedTmdbIds.size} of ${target} of ${challenge.personName}'s ${
      challenge.department ? challenge.department.toLowerCase() : "acting"
    } movies watched`;
  } else if (challenge.type === "LIST" && challenge.listId) {
    // Same shape as CREW above: the grid shows the whole set to work
    // through, watched and not, rather than only what's been logged.
    const items = await prisma.listItem.findMany({
      where: { listId: challenge.listId },
      orderBy: { position: "asc" },
    });
    target = items.length;

    const watchedTmdbIds = await getWatchedAmong(
      ownerId,
      items.map((i) => i.tmdbId)
    );

    credits = items.map((item) => ({
      id: item.tmdbId,
      title: item.title,
      posterPath: item.posterPath,
      year: item.releaseDate?.slice(0, 4),
      owned: ownedIds.has(item.tmdbId),
      inWatchlist: watchlistIds.has(item.tmdbId),
      watched: watchedTmdbIds.has(item.tmdbId),
    }));
    progressCount = watchedTmdbIds.size;
    subtitle = `${watchedTmdbIds.size} of ${target} watched`;
  } else if (challenge.type === "CUSTOM") {
    const films = challenge.films;
    target = films.length;
    const watchedTmdbIds = await getWatchedAmong(
      ownerId,
      films.map((f) => f.tmdbId)
    );
    credits = films.map((film) => ({
      id: film.tmdbId,
      title: film.title,
      posterPath: film.posterPath,
      year: film.releaseDate?.slice(0, 4),
      owned: ownedIds.has(film.tmdbId),
      inWatchlist: watchlistIds.has(film.tmdbId),
      watched: watchedTmdbIds.has(film.tmdbId),
    }));
    progressCount = watchedTmdbIds.size;
    subtitle = `${watchedTmdbIds.size} of ${target} watched`;
  } else {
    // The films that count, found the same way the progress on the card is
    // counted (see genreCount and timeframeCount in lib/challenges.ts). A
    // genre challenge counts every film seen, however that was recorded:
    // diary entry, rating, or the undated "watched" mark. This page used to
    // list diary entries only, so a card could read "Complete, 10 of 10"
    // while the page behind it said "7 of 10" and showed three fewer films.
    // A date-range challenge can only count dated diary entries.
    type CountedMovie = {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      releaseDate: string | null;
    };
    const movieSelect = {
      tmdbId: true,
      title: true,
      posterPath: true,
      releaseDate: true,
    } as const;
    const counted = new Map<number, CountedMovie>();

    if (challenge.type === "GENRE" && challenge.genreName) {
      const where = { userId: ownerId, movie: { genres: { contains: challenge.genreName } } };
      const [logged, marked, rated] = await Promise.all([
        prisma.diaryEntry.findMany({
          where,
          select: { movie: { select: movieSelect } },
          orderBy: { watchedDate: "desc" },
          distinct: ["movieId"],
        }),
        prisma.watchedItem.findMany({
          where,
          select: { movie: { select: movieSelect } },
          orderBy: { addedAt: "desc" },
        }),
        prisma.rating.findMany({
          where,
          select: { movie: { select: movieSelect } },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      for (const row of [...logged, ...marked, ...rated]) {
        if (!counted.has(row.movie.tmdbId)) counted.set(row.movie.tmdbId, row.movie);
      }
    } else if (challenge.type === "TIMEFRAME" && challenge.startDate && challenge.endDate) {
      const logged = await prisma.diaryEntry.findMany({
        where: {
          userId: ownerId,
          watchedDate: { gte: challenge.startDate, lte: challenge.endDate },
        },
        select: { movie: { select: movieSelect } },
        orderBy: { watchedDate: "desc" },
        distinct: ["movieId"],
      });
      for (const row of logged) counted.set(row.movie.tmdbId, row.movie);
    }

    credits = [...counted.values()].map((movie) => ({
      id: movie.tmdbId,
      title: movie.title,
      posterPath: movie.posterPath,
      year: movie.releaseDate?.slice(0, 4),
      owned: ownedIds.has(movie.tmdbId),
      inWatchlist: watchlistIds.has(movie.tmdbId),
      watched: true,
    }));
    progressCount = counted.size;
    subtitle =
      target != null
        ? `${counted.size} of ${target} films ${challenge.type === "GENRE" ? "seen" : "logged"}`
        : `${counted.size} films logged`;
    if (challenge.type === "TIMEFRAME" && challenge.endDate) {
      subtitle += ` · ${formatTimeLeft(challenge.endDate)}`;
    }
  }

  // Only CREW and LIST challenges show films still to watch — GENRE and
  // TIMEFRAME only ever list films already logged (see the `watched: true`
  // branch above), and "is it streaming" is meaningless for something
  // already watched. target/subtitle above are computed from the full,
  // unfiltered set on purpose — filtering narrows what the grid *shows*,
  // not the challenge's actual progress.
  const filterableType = SET_TYPES.has(challenge.type);
  const totalCredits = credits.length;
  const canFilterByAvailability = !!viewerId && hasStreamingAvailability(userProviderIds, ownedIds);
  const applyStreamingFilter = filterableType && streamingOnly && canFilterByAvailability;
  if (applyStreamingFilter) {
    credits = await filterMoviesByStreaming(credits, userProviderIds, ownedIds);
  }

  // GENRE/TIMEFRAME grids are all already-watched films, so for those the
  // films worth adding are the "What to watch next" suggestions.
  const hasAddableFilms = filterableType ? credits.length > 0 : suggestions.length > 0;

  const percent =
    target != null && target > 0 ? Math.min(100, Math.round((progressCount / target) * 100)) : null;
  const status = challengeStatus({ type: challenge.type, percent, endDate: challenge.endDate });

  return (
    <div>
      <Link
        href={isOwner ? "/challenges" : `/profile/${challenge.user.username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {isOwner ? "Challenges" : challenge.user.username}
      </Link>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">
        {TYPE_LABEL[challenge.type] ?? "Challenge"}
        {!isOwner && ` · ${challenge.user.username}`}
      </p>
      <h1 className="page-title flex flex-wrap items-center gap-x-3 gap-y-1">
        {status === "complete" && (
          <ChallengeBadge kind={challenge.type as BadgeKind} size={64} />
        )}
        {challenge.title}
        {status === "complete" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-green px-2.5 py-1 font-sans text-xs font-semibold tracking-normal text-black">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
            Complete
          </span>
        )}
        {status === "ended" && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-sans text-xs font-semibold tracking-normal text-muted">
            Ended
          </span>
        )}
      </h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      {percent != null && (
        <div className="mt-3 max-w-xl">
          <ProgressBar percent={percent} label={`${challenge.title} progress`} className="h-2.5" />
        </div>
      )}
      {challenge.type === "LIST" && challenge.list && (
        <Link
          href={`/lists/${challenge.list.id}`}
          className="mt-1 inline-block text-xs text-muted hover:text-accent-green hover:underline"
        >
          From the list &ldquo;{challenge.list.title}&rdquo;
        </Link>
      )}
      {viewerId && (hasAddableFilms || (isOwner && challenge.type === "CUSTOM")) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasAddableFilms && (
            <AddAllToWatchlistButton
              endpoint={`/api/challenges/${id}/add-to-watchlist`}
              body={applyStreamingFilter ? { streaming: true } : undefined}
            />
          )}
          {isOwner && challenge.type === "CUSTOM" && (
            <EditChallengeFilmsButton
              challengeId={id}
              films={challenge.films.map((f) => ({
                tmdbId: f.tmdbId,
                title: f.title,
                posterPath: f.posterPath,
                releaseDate: f.releaseDate,
              }))}
            />
          )}
        </div>
      )}
      <div className="mb-8" />

      {filterableType && viewerId && totalCredits > 0 && (
        <AvailabilityFilterLinks
          className="mb-6"
          allHref={buildHref(id, false)}
          streamingHref={buildHref(id, true)}
          streamingOnly={streamingOnly}
          canFilterByAvailability={canFilterByAvailability}
        />
      )}

      {credits.length === 0 ? (
        <p className="text-muted">
          {applyStreamingFilter
            ? "None of these movies are on your streaming services or owned right now."
            : challenge.type === "CREW"
              ? "No movie credits found for this person."
              : challenge.type === "LIST"
                ? "That list doesn't have any movies in it yet."
                : challenge.type === "CUSTOM"
                  ? "This challenge doesn't have any films yet."
                  : "No movies have contributed to this challenge yet."}
        </p>
      ) : SET_TYPES.has(challenge.type) ? (
        <FadeWatchedControl>
          <CreditGrid title="Movies" credits={credits} />
        </FadeWatchedControl>
      ) : (
        <CreditGrid title="Movies" credits={credits} />
      )}

      {suggestions.length > 0 && (
        <div className="mt-10">
          <MovieRow
            title="What to watch next"
            movies={suggestions}
            ownedIds={[...ownedIds]}
            watchlistIds={[...watchlistIds]}
          />
        </div>
      )}
    </div>
  );
}
