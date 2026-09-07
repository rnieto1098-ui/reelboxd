import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { formatTimeLeft } from "@/lib/dates";
import {
  getChallengeSuggestions,
  getCrewFilmography,
  getWatchedAmong,
} from "@/lib/challenges";
import { CreditGrid, type CreditDisplay } from "@/components/CreditGrid";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";
import { MovieRow } from "@/components/MovieRow";

const TYPE_LABEL: Record<string, string> = {
  GENRE: "Genre challenge",
  TIMEFRAME: "Time frame challenge",
  CREW: "Crew challenge",
  LIST: "List challenge",
};

export default async function ChallengeDetailPage({
  params,
}: PageProps<"/challenges/[id]">) {
  const { id } = await params;
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
    },
  });
  if (!challenge) notFound();
  const ownerId = challenge.userId;
  const isOwner = viewerId === ownerId;

  const [ownedIds, watchlistIds, suggestions] = await Promise.all([
    getUserOwnedTmdbIds(viewerId),
    getUserWatchlistedTmdbIds(viewerId),
    viewerId ? getChallengeSuggestions(viewerId, challenge) : Promise.resolve([]),
  ]);

  let credits: CreditDisplay[];
  let target: number | null = challenge.target;
  let subtitle: string;

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
    subtitle = `${watchedTmdbIds.size} / ${target} of ${challenge.personName}'s ${
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
    subtitle = `${watchedTmdbIds.size} / ${target} watched`;
  } else {
    const entries = await prisma.diaryEntry.findMany({
      where:
        challenge.type === "GENRE" && challenge.genreName
          ? { userId: ownerId, movie: { genres: { contains: challenge.genreName } } }
          : challenge.type === "TIMEFRAME" && challenge.startDate && challenge.endDate
            ? { userId: ownerId, watchedDate: { gte: challenge.startDate, lte: challenge.endDate } }
            : { userId: ownerId, id: "never-matches" },
      include: { movie: true },
      orderBy: { watchedDate: "desc" },
      distinct: ["movieId"],
    });

    credits = entries.map((entry) => ({
      id: entry.movie.tmdbId,
      title: entry.movie.title,
      posterPath: entry.movie.posterPath,
      year: entry.movie.releaseDate?.slice(0, 4),
      owned: ownedIds.has(entry.movie.tmdbId),
      inWatchlist: watchlistIds.has(entry.movie.tmdbId),
      watched: true,
    }));
    subtitle =
      target != null
        ? `${entries.length} / ${target} films logged`
        : `${entries.length} films logged`;
    if (challenge.type === "TIMEFRAME" && challenge.endDate) {
      subtitle += ` · ${formatTimeLeft(challenge.endDate)}`;
    }
  }

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
      <h1 className="text-2xl font-bold">{challenge.title}</h1>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      {challenge.type === "LIST" && challenge.list && (
        <Link
          href={`/lists/${challenge.list.id}`}
          className="mt-1 inline-block text-xs text-muted hover:text-accent-green hover:underline"
        >
          From the list &ldquo;{challenge.list.title}&rdquo;
        </Link>
      )}
      <div className="mb-8" />

      {credits.length === 0 ? (
        <p className="text-muted">
          {challenge.type === "CREW"
            ? "No movie credits found for this person."
            : challenge.type === "LIST"
              ? "That list doesn't have any movies in it yet."
              : "No movies have contributed to this challenge yet."}
        </p>
      ) : challenge.type === "CREW" || challenge.type === "LIST" ? (
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
