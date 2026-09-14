import Link from "next/link";
import { posterUrl } from "@/lib/tmdb";
import { PosterQuickActions } from "@/components/PosterQuickActions";
import { PosterImage } from "@/components/PosterImage";

export function MovieCard({
  tmdbId,
  title,
  posterPath,
  year,
  owned,
  inWatchlist,
  watched,
}: {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  year?: string;
  owned?: boolean;
  inWatchlist?: boolean;
  // Left undefined by callers whose movies are unwatched by construction
  // (recommendations, upcoming releases) — PosterQuickActions defaults it
  // to false, which is correct there.
  watched?: boolean;
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
          <PosterImage src={src} alt={title} />
        </Link>
        <PosterQuickActions
          tmdbId={tmdbId}
          initialOwned={owned}
          initialInWatchlist={inWatchlist}
          initialWatched={watched}
        />
      </div>
      {/* min-h reserves a full two lines regardless of the actual title's
          length, so a row of short and long titles still bottom-align —
          line-clamp-2 alone would let each card's height follow its own
          title, and this row's flex container stretches every card to the
          tallest one anyway. title= is a plain native tooltip backstop for
          anything long enough to still clip at two lines. */}
      <Link
        href={href}
        title={title}
        className="mt-1.5 block line-clamp-2 min-h-[2.5rem] text-sm font-medium group-hover:text-accent-green transition-colors"
      >
        {title}
      </Link>
      {year && <p className="text-xs text-muted">{year}</p>}
    </div>
  );
}
