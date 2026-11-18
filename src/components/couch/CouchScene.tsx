import type { ReactNode } from "react";
import { CouchStage } from "@/components/couch/CouchStage";

/**
 * The couch's-eye view of the living room, with whatever is passed as
 * children drawn on the TV screen. The photo covers the area like a
 * background, cropped at the sides; on phones it's zoomed in so the TV
 * fills the width of the screen (see .couch-stage). CouchStage moves the
 * camera in towards the TV and switches it on.
 */
export function CouchScene({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="couch-area bleed relative -mt-6 overflow-hidden bg-black sm:-mt-8">
      <CouchStage>{children}</CouchStage>
      {footer}
    </div>
  );
}
