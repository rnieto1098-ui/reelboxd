import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ListImportForm } from "@/components/ListImportForm";
import { SavedMoviesPage } from "@/components/SavedMoviesPage";

export default async function WatchlistPage({ searchParams }: PageProps<"/watchlist">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  return (
    <SavedMoviesPage
      userId={userId}
      searchParams={await searchParams}
      basePath="/watchlist"
      title="Your Watchlist"
      emptyMessage={<>Nothing here yet. Find a movie and click &ldquo;+ Watchlist&rdquo; to add it.</>}
      allInWatchlist
      loadItems={(orderBy) =>
        prisma.watchlistItem.findMany({
          where: { userId },
          include: { movie: { include: { customPosters: { where: { userId } } } } },
          orderBy,
        })
      }
      headerActions={(itemCount) => (
        <>
          <ListImportForm
            endpoint="/api/watchlist/import"
            listName="watchlist"
            description={
              <>
                Upload a Letterboxd watchlist.csv (or the full export .zip from{" "}
                <a
                  href="https://letterboxd.com/user/exportdata/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-green hover:underline"
                >
                  letterboxd.com/user/exportdata
                </a>
                ), or a watchlist.csv you exported from Flixtally — everything in it gets added
                straight to your watchlist. Ratings and other data are ignored; use{" "}
                <a href="/import" className="text-accent-green hover:underline">
                  full import
                </a>{" "}
                for those.
              </>
            }
          />
          {itemCount > 0 && (
            // A plain <a>, not <Link>: this is a file download from an API
            // route, not a page navigation.
            <a
              href="/api/watchlist/export"
              download
              className="text-sm text-muted hover:text-accent-green hover:underline"
            >
              Export as CSV
            </a>
          )}
        </>
      )}
    />
  );
}
