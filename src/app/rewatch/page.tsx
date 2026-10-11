import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SavedMoviesPage } from "@/components/SavedMoviesPage";
import { ListImportForm } from "@/components/ListImportForm";

export default async function RewatchPage({ searchParams }: PageProps<"/rewatch">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  return (
    <SavedMoviesPage
      userId={userId}
      searchParams={await searchParams}
      basePath="/rewatch"
      title="Your Rewatch List"
      emptyMessage={
        <>
          Nothing here yet. Open a movie and click &ldquo;Rewatch list&rdquo; under its poster, or use
          the rewatch button when you hover over any poster. Logging a watch takes it off again.
        </>
      }
      allInWatchlist={false}
      headerActions={(itemCount) => (
        <>
          <ListImportForm
            endpoint="/api/rewatch/import"
            listName="rewatch list"
            description={
              <>
                Upload a .csv with <code className="text-foreground">Name</code> and{" "}
                <code className="text-foreground">Year</code> columns — like a rewatch-list CSV you
                exported from Flixtally — or a full Flixtally account export .zip. Movies you&apos;ve
                already watched are kept; that&apos;s what this list is for.
              </>
            }
          />
          {itemCount > 0 && (
            // A plain <a>, not <Link>: this is a file download from an API
            // route, not a page navigation.
            <a
              href="/api/rewatch/export"
              download
              className="text-sm text-muted hover:text-accent-green hover:underline"
            >
              Export as CSV
            </a>
          )}
        </>
      )}
      loadItems={(orderBy) =>
        prisma.rewatchItem.findMany({
          where: { userId },
          include: { movie: { include: { customPosters: { where: { userId } } } } },
          orderBy,
        })
      }
    />
  );
}
