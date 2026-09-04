import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { OwnedMovieGrid, type OwnedGridEntry } from "@/components/OwnedMovieGrid";

export default async function OwnedMoviesPage({
  params,
}: PageProps<"/profile/[username]/owned">) {
  const { username } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const [owned, watchlistedTmdbIds] = await Promise.all([
    prisma.ownedItem.findMany({
      where: { userId: user.id },
      include: { movie: true },
      orderBy: { addedAt: "desc" },
    }),
    // The viewer's own watchlist, not necessarily the profile owner's — same
    // convention as everywhere else a poster's quick-action state reflects
    // whoever is looking, not whoever the page belongs to.
    getUserWatchlistedTmdbIds(session?.user?.id),
  ]);

  const posterOverrides = await getCustomPosterMap(
    session?.user?.id,
    owned.map((o) => o.movie.tmdbId)
  );

  const entries: OwnedGridEntry[] = owned.map((o) => ({
    id: o.id,
    tmdbId: o.movie.tmdbId,
    title: o.movie.title,
    posterPath: posterOverrides.get(o.movie.tmdbId) ?? o.movie.posterPath,
    year: o.movie.releaseDate?.slice(0, 4),
    inWatchlist: watchlistedTmdbIds.has(o.movie.tmdbId),
  }));

  return (
    <div>
      <Link
        href={`/profile/${username}`}
        className="text-sm text-muted hover:text-foreground hover:underline"
      >
        ← {username}
      </Link>
      <h1 className="mt-1 text-2xl font-bold">{username}&apos;s Owned Movies</h1>
      <p className="mb-8 text-sm text-muted">
        {entries.length} movie{entries.length === 1 ? "" : "s"} owned
      </p>

      {entries.length === 0 ? (
        <p className="text-muted">No owned movies marked yet.</p>
      ) : (
        <OwnedMovieGrid entries={entries} />
      )}
    </div>
  );
}
