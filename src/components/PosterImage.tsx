"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "@/components/icons";

/**
 * A poster/cover image with a real fallback for both ways it can be
 * missing: no path to try at all (`src` is null), and a path that TMDB
 * (or Blob storage) 404s on when actually fetched — a stale/removed asset,
 * not something a null check alone catches. `next/image`'s `onError` only
 * fires client-side, which is why this can't live inline in the (Server
 * Component) callers that use it — same reason PosterQuickActions is its
 * own file next to MovieCard rather than folded into it.
 */
export function PosterImage({
  src,
  alt,
  year,
  quality = 80,
}: {
  src: string | null;
  alt: string;
  // Shown under the title on the placeholder, so a poster-less card still
  // reads like a title card rather than an empty slot.
  year?: string;
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <PosterPlaceholder title={alt} year={year} />;

  return (
    <Image
      src={src}
      alt={alt}
      width={342}
      height={513}
      quality={quality}
      className="h-full w-full object-cover transition-transform group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The one "no image" look shared by every poster/cover slot in the app —
 * a missing path and a failed load both land here, so neither ever shows
 * as a blank cell or bare browser broken-image icon.
 */
export function PosterPlaceholder({ title, year }: { title: string; year?: string }) {
  return (
    // @container: the same placeholder fills a 112px row card and a 240px
    // movie-page poster, so the text scales with the slot, not the viewport.
    <div className="@container flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-surface-hover via-surface to-background p-3 text-center">
      <ImageIcon className="mb-1 h-5 w-5 shrink-0 text-muted opacity-50 @[12rem]:h-8 @[12rem]:w-8" />
      <span className="line-clamp-4 text-xs font-semibold leading-snug text-foreground/90 @[12rem]:text-xl">
        {title}
      </span>
      {year && <span className="text-[11px] text-muted @[12rem]:text-sm">{year}</span>}
    </div>
  );
}
