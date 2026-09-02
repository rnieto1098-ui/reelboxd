import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { posterUrl } from "@/lib/tmdb";
import { ensureSystemLists } from "@/lib/systemLists";
import { getPersonalListCoverMap } from "@/lib/listCovers";
import { CreateListForm } from "@/components/CreateListForm";
import { ListRow } from "@/components/ListRow";
import { parseStoredTags } from "@/lib/listTags";

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const { tag } = await searchParams;
  const activeTag = typeof tag === "string" ? tag : null;

  const session = await auth();
  await ensureSystemLists();

  const [systemLists, userLists] = await Promise.all([
    prisma.list.findMany({
      where: { isSystem: true },
      include: {
        _count: { select: { items: true } },
        items: { take: 1, orderBy: { position: "asc" } },
      },
    }),
    session?.user?.id
      ? prisma.list.findMany({
          where: { ownerId: session.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { items: true } },
            items: { take: 1, orderBy: { position: "asc" } },
          },
        })
      : Promise.resolve([]),
  ]);

  const personalCovers = await getPersonalListCoverMap(session?.user?.id, [
    ...systemLists.map((l) => l.id),
    ...userLists.map((l) => l.id),
  ]);

  const systemListCards = systemLists.map((list) => ({
    id: list.id,
    title: list.title,
    coverPosterPath: list.items[0]?.posterPath ?? null,
    coverImage: personalCovers.get(list.id) ?? list.coverImage,
    itemCount: list._count.items,
  }));

  const userListsWithTags = userLists.map((list) => ({ ...list, tagList: parseStoredTags(list.tags) }));
  const tagsByKey = new Map<string, string>();
  for (const list of userListsWithTags) {
    for (const t of list.tagList) {
      const key = t.toLowerCase();
      if (!tagsByKey.has(key)) tagsByKey.set(key, t);
    }
  }
  const allTags = [...tagsByKey.values()].sort((a, b) => a.localeCompare(b));
  // Case-insensitive match — a tag's display casing (from whichever list
  // set it first) doesn't have to match the casing in the URL.
  const visibleLists = activeTag
    ? userListsWithTags.filter((l) => l.tagList.some((t) => t.toLowerCase() === activeTag.toLowerCase()))
    : userListsWithTags;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Lists</h1>
      <p className="mb-8 text-sm text-muted">
        Browse curated lists, or build your own collection of movies.
      </p>

      <div className="mb-10">
        <ListRow title="Curated Lists" lists={systemListCards} />
      </div>

      {session?.user && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Lists</h2>
            <CreateListForm />
          </div>

          {allTags.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
              <Link
                href="/lists"
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  !activeTag ? "bg-accent-green text-black" : "border border-border text-muted hover:text-foreground"
                }`}
              >
                All
              </Link>
              {allTags.map((t) => (
                <Link
                  key={t}
                  href={`/lists?tag=${encodeURIComponent(t)}`}
                  className={`rounded-full px-2.5 py-1 transition-colors ${
                    activeTag?.toLowerCase() === t.toLowerCase()
                      ? "bg-accent-green text-black"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </Link>
              ))}
            </div>
          )}

          {userLists.length === 0 ? (
            <p className="text-sm text-muted">You haven&apos;t made any lists yet.</p>
          ) : visibleLists.length === 0 ? (
            <p className="text-sm text-muted">No lists tagged &ldquo;{activeTag}&rdquo;.</p>
          ) : (
            <ListGrid lists={visibleLists} personalCovers={personalCovers} />
          )}
        </section>
      )}
    </div>
  );
}

function ListGrid({
  lists,
  personalCovers,
}: {
  lists: {
    id: string;
    title: string;
    description: string | null;
    coverImage: string | null;
    items: { posterPath: string | null }[];
    _count: { items: number };
    tagList: string[];
  }[];
  personalCovers: Map<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {lists.map((list) => {
        const cover =
          personalCovers.get(list.id) ??
          list.coverImage ??
          posterUrl(list.items[0]?.posterPath ?? null, "w342");
        return (
          <Link key={list.id} href={`/lists/${list.id}`} className="group block">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-surface">
              {cover ? (
                <Image
                  src={cover}
                  alt={list.title}
                  width={342}
                  height={513}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted">
                  {list.title}
                </div>
              )}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium group-hover:text-accent-green transition-colors">
              {list.title}
            </p>
            <p className="text-xs text-muted">
              {list._count.items} movie{list._count.items === 1 ? "" : "s"}
            </p>
            {list.tagList.length > 0 && (
              <p className="mt-0.5 truncate text-[11px] text-muted">{list.tagList.join(" · ")}</p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
