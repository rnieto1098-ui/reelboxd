import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { PosterQuickActions } from "@/components/PosterQuickActions";

export function MovieCard({
  tmdbId,
  title,
  posterPath,
  year,
}: {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year?: string;
}) {
  const src = posterUrl(posterPath);

  const href = `/movie/${tmdbId}`;

  return (
    <div className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-surface border border-border">
        {/* A <button> can't legally sit inside an <a>, so the quick-action
            buttons are a sibling overlay on top of this link, not nested
            inside it — nesting them worked in some browsers but not
            reliably, since it's invalid HTML with undefined click behavior. */}
        <Link href={href} className="absolute inset-0">
          {src ? (
            <Image
              src={src}
              alt={title}
              width={342}
              height={513}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted">
              {title}
            </div>
          )}
        </Link>
        <PosterQuickActions tmdbId={tmdbId} />
      </div>
      <Link
        href={href}
        className="mt-1.5 block truncate text-sm font-medium group-hover:text-accent-green transition-colors"
      >
        {title}
      </Link>
      {year && <p className="text-xs text-muted">{year}</p>}
    </div>
  );
}
