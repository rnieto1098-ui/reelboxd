import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SavedMoviesPage } from "@/components/SavedMoviesPage";

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
      headerActions={(itemCount) =>
        itemCount > 0 && (
          // A plain <a>, not <Link>: this is a file download from an API
          // route, not a page navigation.
          <a
            href="/api/rewatch/export"
            download
            className="text-sm text-muted hover:text-accent-green hover:underline"
          >
            Export as CSV
          </a>
        )
      }
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
