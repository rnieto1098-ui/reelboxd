import Link from "next/link";
import { HorizontalScroller } from "@/components/HorizontalScroller";
import { PosterImage } from "@/components/PosterImage";
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
            className="group w-28 flex-shrink-0 sm:w-32 md:w-36"
          >
            <div className="aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-surface">
              <PosterImage src={cover} alt={list.title} />
            </div>
            <p
              title={list.title}
              className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium group-hover:text-accent-green transition-colors"
            >
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
