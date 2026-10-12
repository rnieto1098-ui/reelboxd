import type { CSSProperties } from "react";

// Site backgrounds a user can pick in Settings. Images live in
// public/backgrounds (generated with Higgsfield, 2048px WebP). User.backgroundImage
// stores one of:
//   null                — match each tab: every nav tab gets its own preset
//                         (TAB_BACKGROUNDS), other pages get FALLBACK_BACKGROUND_ID
//   "preset:<id>"       — one chosen preset everywhere (stored by id so files can be renamed)
//   "none"              — a plain background
//   anything else       — the URL of the user's own uploaded Vercel Blob image

export type BackgroundPreset = { id: string; name: string; src: string };

function preset(id: string, name: string): BackgroundPreset {
  return { id, name, src: `/backgrounds/${id}.webp` };
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  preset("festival-lights", "Festival Lights"),
  preset("video-store", "Video Store"),
  preset("planning-desk", "Planning Desk"),
  preset("movie-night", "Movie Night"),
  preset("rewind", "Rewind"),
  preset("summit-trail", "Summit Trail"),
  preset("film-set", "Film Set"),
  preset("frame-wall", "Frame Wall"),
  preset("projector-prism", "Projector Prism"),
  preset("film-strip", "Film Strip"),
  preset("empty-theater", "Empty Theater"),
  preset("projection-booth", "Projection Booth"),
  preset("drive-in", "Drive-In"),
];

// Route prefix → preset, checked in order. Home and every page without its
// own entry (movie pages, search, settings…) use the fallback.
const TAB_BACKGROUNDS: [prefix: string, presetId: string][] = [
  ["/recommend", "video-store"],
  ["/lists", "planning-desk"],
  ["/watchlist", "movie-night"],
  ["/rewatch", "rewind"],
  ["/challenges", "summit-trail"],
  ["/crew", "film-set"],
  ["/profile", "frame-wall"],
];

export const FALLBACK_BACKGROUND_ID = "festival-lights";
export const MATCH_TAB = "auto";
export const NO_BACKGROUND = "none";
const PRESET_PREFIX = "preset:";

export type BackgroundChoice =
  | { kind: "preset"; preset: BackgroundPreset }
  | { kind: "none" }
  | { kind: "upload"; url: string };

function presetById(id: string): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find((p) => p.id === id);
}

export function presetValue(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

export function tabBackground(pathname: string): BackgroundPreset {
  const match = TAB_BACKGROUNDS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return presetById(match?.[1] ?? FALLBACK_BACKGROUND_ID)!;
}

export function resolveBackground(
  stored: string | null | undefined,
  pathname = "/"
): BackgroundChoice {
  if (stored === NO_BACKGROUND) return { kind: "none" };
  if (stored && !stored.startsWith(PRESET_PREFIX)) return { kind: "upload", url: stored };
  // A preset id that no longer exists falls back to the tab's background
  // rather than leaving the user with a broken image.
  const preset =
    (stored ? presetById(stored.slice(PRESET_PREFIX.length)) : undefined) ??
    tabBackground(pathname);
  return { kind: "preset", preset };
}

// What the Settings picker shows as selected: a preset id, MATCH_TAB,
// NO_BACKGROUND, or "upload".
export function pickerSelection(stored: string | null | undefined): string {
  if (stored == null) return MATCH_TAB;
  const choice = resolveBackground(stored);
  if (choice.kind === "none") return NO_BACKGROUND;
  if (choice.kind === "upload") return "upload";
  return stored.startsWith(PRESET_PREFIX) && presetById(stored.slice(PRESET_PREFIX.length))
    ? choice.preset.id
    : MATCH_TAB;
}

// Only uploads are ours to delete from Blob storage; presets and "none" are not files.
export function isUploadedBackground(stored: string | null | undefined): stored is string {
  return resolveBackground(stored).kind === "upload";
}

// Presets are designed dark, so they need a lighter overlay than an arbitrary
// uploaded photo to stay visible while keeping text readable.
export function backgroundStyle(
  stored: string | null | undefined,
  pathname = "/"
): CSSProperties | undefined {
  const choice = resolveBackground(stored, pathname);
  if (choice.kind === "none") return undefined;
  const [url, overlay] =
    choice.kind === "upload" ? [choice.url, 0.88] : [choice.preset.src, 0.6];
  return {
    backgroundImage: `linear-gradient(rgba(20, 24, 28, ${overlay}), rgba(20, 24, 28, ${overlay})), url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}
