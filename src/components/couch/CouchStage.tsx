"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Maximize2, Minimize2 } from "lucide-react";

// Where the TV's screen sits in /couch/room.webp, as a fraction of the
// image (measured from the generated photo: the screen is square-on, so a
// plain rectangle lines up without any perspective transform). If the room
// image is ever replaced, these numbers are what need re-measuring, along
// with the aspect ratio in globals.css (.couch-stage).
const SCREEN = { left: 0.2649, top: 0.0745, width: 0.4702, height: 0.4601 };
const SCREEN_CENTER = { x: SCREEN.left + SCREEN.width / 2, y: SCREEN.top + SCREEN.height / 2 };

// How much of the visible area the TV fills once the camera has moved in.
const ZOOM_FILL = { width: 0.76, height: 0.74 };
const MOVE_MS = 2200;
const START_DELAY_MS = 450;

type Camera = { scale: number; x: number; y: number };
const AT_REST: Camera = { scale: 1, x: 0, y: 0 };

/**
 * The room photo plus the TV screen, with a camera that starts wide on the
 * whole room and moves in until the TV fills most of the view. The TV
 * switches on once the camera arrives. The photo and the screen share one
 * transformed layer, so the screen stays locked to the TV throughout.
 */
export function CouchStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [camera, setCamera] = useState<Camera>(AT_REST);
  const [poweredOn, setPoweredOn] = useState(false);
  const [instant, setInstant] = useState(false);

  // The camera position that puts the TV in the middle of the visible area
  // at ZOOM_FILL, without ever pulling an edge of the photo into view.
  const measure = useCallback((): Camera => {
    const stage = stageRef.current;
    const area = stage?.parentElement;
    if (!stage || !area) return AT_REST;
    const S = stage.getBoundingClientRect();
    const A = area.getBoundingClientRect();
    const screenW = S.width * SCREEN.width;
    const screenH = S.height * SCREEN.height;
    const scale = Math.max(1, Math.min((ZOOM_FILL.width * A.width) / screenW, (ZOOM_FILL.height * A.height) / screenH));
    if (scale < 1.05) return AT_REST; // phones: the TV already fills the width

    const cx = S.left + S.width * SCREEN_CENTER.x;
    const cy = S.top + S.height * SCREEN_CENTER.y;
    let x = A.left + A.width / 2 - cx;
    let y = A.top + A.height / 2 - cy;
    // After scaling about the screen's centre and moving by (x, y), the
    // photo's edges sit at cx + x - scale * (cx - S.left) and so on. Keep
    // them outside the visible area.
    const left = (dx: number) => cx + dx - scale * (cx - S.left);
    const right = (dx: number) => cx + dx + scale * (S.right - cx);
    const top = (dy: number) => cy + dy - scale * (cy - S.top);
    const bottom = (dy: number) => cy + dy + scale * (S.bottom - cy);
    if (left(x) > A.left) x -= left(x) - A.left;
    if (right(x) < A.right) x += A.right - right(x);
    if (top(y) > A.top) y -= top(y) - A.top;
    if (bottom(y) < A.bottom) y += A.bottom - bottom(y);
    return { scale, x, y };
  }, []);

  // Start wide, then move in. With reduced motion, jump straight there.
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = setTimeout(
      () => {
        setInstant(calm);
        setCamera(measure());
        setZoomed(true);
        if (calm) setPoweredOn(true);
      },
      calm ? 0 : START_DELAY_MS
    );
    // Switch the TV on as the camera settles (also covers phones, where
    // the camera doesn't move at all).
    const power = calm ? undefined : setTimeout(() => setPoweredOn(true), START_DELAY_MS + MOVE_MS * 0.8);
    return () => {
      clearTimeout(move);
      clearTimeout(power);
    };
  }, [measure]);

  // A resized window needs a new camera position, applied without the
  // slow move so the view doesn't drift after every resize.
  useLayoutEffect(() => {
    const area = stageRef.current?.parentElement;
    if (!area) return;
    const observer = new ResizeObserver(() => {
      if (!zoomed) return;
      setInstant(true);
      setCamera(measure());
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [zoomed, measure]);

  function toggle() {
    setInstant(false);
    if (zoomed) {
      setCamera(AT_REST);
      setZoomed(false);
    } else {
      setCamera(measure());
      setZoomed(true);
    }
  }

  const canZoom = camera.scale > 1 || !zoomed;

  return (
    <>
      <div ref={stageRef} className="couch-stage absolute left-1/2 top-0 -translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2">
        <div
          className="absolute inset-0 will-change-transform"
          onTransitionEnd={() => setInstant(false)}
          style={{
            transformOrigin: `${SCREEN_CENTER.x * 100}% ${SCREEN_CENTER.y * 100}%`,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
            transition: instant ? "none" : `transform ${MOVE_MS}ms cubic-bezier(0.45, 0, 0.2, 1)`,
          }}
        >
          <Image
            src="/couch/room.webp"
            alt="A living room at night, seen from the sofa, with a television on the wall"
            fill
            priority
            quality={85}
            sizes="(max-width: 639px) 200vw, 180vw"
            className="pointer-events-none select-none object-cover"
          />
          <div
            className={`absolute overflow-hidden rounded-[0.3%] bg-black [container-type:size] ${
              poweredOn ? "shadow-[0_0_6vw_0.8vw_rgba(110,150,255,0.16)]" : ""
            }`}
            style={{
              left: `${SCREEN.left * 100}%`,
              top: `${SCREEN.top * 100}%`,
              width: `${SCREEN.width * 100}%`,
              height: `${SCREEN.height * 100}%`,
            }}
          >
            {/* Rendered from the start (so the content is ready), shown
                only once the TV is on. */}
            <div className={poweredOn ? "animate-tv-on h-full w-full" : "invisible h-full w-full"}>{children}</div>
          </div>
        </div>
      </div>

      {canZoom && (
        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/75 hover:text-white sm:flex"
        >
          {zoomed ? <Minimize2 aria-hidden className="h-3.5 w-3.5" /> : <Maximize2 aria-hidden className="h-3.5 w-3.5" />}
          {zoomed ? "Lean back" : "Lean in"}
        </button>
      )}
    </>
  );
}
