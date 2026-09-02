import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserOwnedTmdbIds } from "@/lib/streaming";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { getCrewFilmography } from "@/lib/challenges";
import { CreditGrid, type CreditDisplay } from "@/components/CreditGrid";
import { FadeWatchedControl } from "@/components/FadeWatchedControl";

const TYPE_LABEL: Record<string, string> = {
  GENRE: "Genre challenge",
  TIMEFRAME: "Time frame challenge",
  CREW: "Crew challenge",
};

export default async function ChallengeDetailPage({
  params,
}: PageProps<"/challenges/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge || challenge.userId !== userId) notFound();

  const [ownedIds, watchlistIds] = await Promise.all([
    getUserOwnedTmdbIds(userId),
    getUserWatchlistedTmdbIds(userId),
  ]);

  let credits: CreditDisplay[];
  let target: number | null = challenge.target;
  let subtitle: string;

  if (challenge.type === "CREW" && challenge.personId != null) {
    const filmography = await getCrewFilmography(challenge.personId, challenge.department);
    target = filmography.length;

    const logged = await prisma.diaryEntry.findMany({
      where: { userId, movie: { tmdbId: { in: filmography.map((c) => c.id) } } },
      select: { movie: { select: { tmdbId: true } } },
      distinct: ["movieId"],
    });
    const watchedTmdbIds = new Set(logged.map((l) => l.movie.tmdbId));

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
  } else {
    const entries = await prisma.diaryEntry.findMany({
      where:
        challenge.type === "GENRE" && challenge.genreName
          ? { userId, movie: { genres: { contains: challenge.genreName } } }
          : challenge.type === "TIMEFRAME" && challenge.startDate && challenge.endDate
            ? { userId, watchedDate: { gte: challenge.startDate, lte: challenge.endDate } }
            : { userId, id: "never-matches" },
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
  }

  return (
    <div>
      <Link
        href="/challenges"
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← Challenges
      </Link>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted">
        {TYPE_LABEL[challenge.type] ?? "Challenge"}
      </p>
      <h1 className="text-2xl font-bold">{challenge.title}</h1>
      <p className="mb-8 mt-1 text-sm text-muted">{subtitle}</p>

      {credits.length === 0 ? (
        <p className="text-muted">
          {challenge.type === "CREW"
            ? "No movie credits found for this person."
            : "No movies have contributed to this challenge yet."}
        </p>
      ) : challenge.type === "CREW" ? (
        <FadeWatchedControl>
          <CreditGrid title="Movies" credits={credits} />
        </FadeWatchedControl>
      ) : (
        <CreditGrid title="Movies" credits={credits} />
      )}
    </div>
  );
}
