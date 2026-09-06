import Link from "next/link";

// The Prev/Next footer the search page has always had, pulled out so the
// "view all" pages (diary, owned) can bound how much they load per request
// without each reinventing the same three links. Callers supply hrefFor for
// the same reason SortChips does — only the URL shape differs between pages.
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const linkClass = "rounded-full px-3 py-1 text-muted transition-colors hover:text-foreground";
  const disabledClass = "rounded-full px-3 py-1 text-muted/40";

  return (
    <div className="mt-8 flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          ← Prev
        </Link>
      ) : (
        <span className={disabledClass}>← Prev</span>
      )}
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          Next →
        </Link>
      ) : (
        <span className={disabledClass}>Next →</span>
      )}
    </div>
  );
}
