import Image from "next/image";
import type { ReactNode } from "react";

// Where the TV's screen sits in /couch/room.webp, as a percentage of the
// image (measured from the generated photo: the screen is square-on, so a
// plain rectangle lines up without any perspective transform). If the room
// image is ever replaced, these four numbers are what need re-measuring,
// along with the aspect ratio in globals.css (.couch-stage).
const SCREEN = { left: 26.49, top: 7.45, width: 47.02, height: 46.01 };

/**
 * The couch's-eye view of the living room, with whatever is passed as
 * children drawn on the TV screen. The photo covers the area like a
 * background, cropped at the sides; on phones it's zoomed in so the TV
 * fills the width of the screen (see .couch-stage).
 */
export function CouchScene({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="couch-area bleed relative -mt-6 overflow-hidden bg-black sm:-mt-8">
      <div className="couch-stage absolute left-1/2 top-0 -translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2">
        <Image
          src="/couch/room.webp"
          alt="A living room at night, seen from the sofa, with a television on the wall"
          fill
          priority
          quality={90}
          sizes="(max-width: 639px) 200vw, 100vw"
          className="pointer-events-none select-none object-cover"
        />
        <div
          className="absolute overflow-hidden rounded-[0.3%] bg-black shadow-[0_0_6vw_0.8vw_rgba(110,150,255,0.16)] [container-type:size]"
          style={{
            left: `${SCREEN.left}%`,
            top: `${SCREEN.top}%`,
            width: `${SCREEN.width}%`,
            height: `${SCREEN.height}%`,
          }}
        >
          {children}
        </div>
      </div>
      {footer}
    </div>
  );
}
