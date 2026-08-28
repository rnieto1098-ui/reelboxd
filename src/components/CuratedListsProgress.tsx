import Link from "next/link";
import type { ListProgress } from "@/lib/systemLists";

export function CuratedListsProgress({ lists }: { lists: ListProgress[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Your List Progress</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/lists/${list.id}`}
            className="rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent-green"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{list.title}</span>
              <span className="shrink-0 text-muted">{list.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-accent-green"
                style={{ width: `${list.percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              {list.watchedCount} / {list.itemCount} watched
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
