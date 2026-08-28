import Image from "next/image";
import Link from "next/link";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { posterUrl } from "@/lib/tmdb";
import type { ListCard } from "@/lib/systemLists";

export function ListRow({ title, lists }: { title: string; lists: ListCard[] }) {
  return (
    <HorizontalScroller title={title} isEmpty={lists.length === 0}>
      {lists.map((list) => {
        const cover = list.coverImage ?? posterUrl(list.coverPosterPath, "w342");
        return (
          <Link
            key={list.id}
            href={`/lists/${list.id}`}
            className="group w-24 flex-shrink-0 sm:w-28"
          >
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
              {list.itemCount} movie{list.itemCount === 1 ? "" : "s"}
            </p>
          </Link>
        );
      })}
    </HorizontalScroller>
  );
}
