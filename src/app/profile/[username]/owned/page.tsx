import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPosterMap } from "@/lib/customPosters";
import { getUserWatchlistedTmdbIds } from "@/lib/movies";
import { OwnedMovieGrid, type OwnedGridEntry } from "@/components/OwnedMovieGrid";
import { Pagination } from "@/components/Pagination";

// A collection has no natural ceiling, and this page used to load every row
// (each with its full Movie join) into one response and one DOM. Paged so
// the cost of viewing a 2,000-film collection is the same as a 20-film one.
const PAGE_SIZE = 60;

export default async function OwnedMoviesPage({
  params,
  searchParams,
}: PageProps<"/profile/[username]/owned">) {
  const { username } = await params;
  const { page: pageParam } = await searchParams;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) notFound();

  const requestedPage = Number(pageParam);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [owned, totalCount, watchlistedTmdbIds] = await Promise.all([
    prisma.ownedItem.findMany({
      where: { userId: user.id },
      include: { movie: true },
      orderBy: { addedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.ownedItem.count({ where: { userId: user.id } }),
    // The viewer's own watchlist, not necessarily the profile owner's — same
    // convention as everywhere else a poster's quick-action state reflects
    // whoever is looking, not whoever the page belongs to.
    getUserWatchlistedTmdbIds(session?.user?.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
        {totalCount} movie{totalCount === 1 ? "" : "s"} owned
      </p>

      {totalCount === 0 ? (
        <p className="text-muted">No owned movies marked yet.</p>
      ) : entries.length === 0 ? (
        <p className="text-muted">Nothing on this page — try going back.</p>
      ) : (
        <OwnedMovieGrid entries={entries} />
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(target) =>
          target === 1
            ? `/profile/${username}/owned`
            : `/profile/${username}/owned?page=${target}`
        }
      />
    </div>
  );
}
