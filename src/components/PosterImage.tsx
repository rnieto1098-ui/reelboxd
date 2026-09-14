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
  quality = 80,
}: {
  src: string | null;
  alt: string;
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <PosterPlaceholder title={alt} />;

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
export function PosterPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center text-muted">
      <ImageIcon className="h-6 w-6 shrink-0 opacity-60" />
      <span className="line-clamp-3 text-xs">{title}</span>
    </div>
  );
}
