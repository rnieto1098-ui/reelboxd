"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Dialog } from "@/components/Dialog";

/**
 * "Watch trailer": opens the film's trailer in a player over the page.
 *
 * The player is YouTube's privacy-enhanced embed (youtube-nocookie.com),
 * and it is only added to the page when the button is pressed, so merely
 * opening a movie page loads nothing from YouTube and sets none of its
 * cookies.
 */
export function TrailerButton({
  videoKey,
  title,
  className = "btn btn-primary btn-lg",
}: {
  // The YouTube video id, from TMDB's video list.
  videoKey: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Play aria-hidden className="h-5 w-5 fill-current" />
        Watch trailer
      </button>

      {open && (
        <Dialog title={`${title} trailer`} onClose={() => setOpen(false)} size="xl" bare>
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&rel=0`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
            />
          </div>
        </Dialog>
      )}
    </>
  );
}
