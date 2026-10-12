import type { CSSProperties } from "react";

// Site backgrounds a user can pick in Settings. Images live in
// public/backgrounds (generated with Higgsfield, 2048px WebP). User.backgroundImage
// stores one of:
//   null                — the default preset
//   "preset:<id>"       — a chosen preset (stored by id so files can be renamed)
//   "none"              — a plain background
//   anything else       — the URL of the user's own uploaded Vercel Blob image

export type BackgroundPreset = { id: string; name: string; src: string };

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "festival-lights", name: "Festival Lights", src: "/backgrounds/festival-lights.webp" },
  { id: "projector-prism", name: "Projector Prism", src: "/backgrounds/projector-prism.webp" },
  { id: "film-strip", name: "Film Strip", src: "/backgrounds/film-strip.webp" },
  { id: "empty-theater", name: "Empty Theater", src: "/backgrounds/empty-theater.webp" },
  { id: "projection-booth", name: "Projection Booth", src: "/backgrounds/projection-booth.webp" },
  { id: "drive-in", name: "Drive-In", src: "/backgrounds/drive-in.webp" },
];

export const DEFAULT_BACKGROUND_ID = "festival-lights";
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

export function resolveBackground(stored: string | null | undefined): BackgroundChoice {
  if (stored === NO_BACKGROUND) return { kind: "none" };
  if (stored && !stored.startsWith(PRESET_PREFIX)) return { kind: "upload", url: stored };
  // A preset id that no longer exists falls back to the default rather than
  // leaving the user with a broken image.
  const preset =
    (stored ? presetById(stored.slice(PRESET_PREFIX.length)) : undefined) ??
    presetById(DEFAULT_BACKGROUND_ID)!;
  return { kind: "preset", preset };
}

// Only uploads are ours to delete from Blob storage; presets and "none" are not files.
export function isUploadedBackground(stored: string | null | undefined): stored is string {
  return resolveBackground(stored).kind === "upload";
}

// Presets are designed dark, so they need a lighter overlay than an arbitrary
// uploaded photo to stay visible while keeping text readable.
export function backgroundStyle(stored: string | null | undefined): CSSProperties | undefined {
  const choice = resolveBackground(stored);
  if (choice.kind === "none") return undefined;
  const [url, overlay] =
    choice.kind === "upload" ? [choice.url, 0.88] : [choice.preset.src, 0.6];
  return {
    backgroundImage: `linear-gradient(rgba(20, 24, 28, ${overlay}), rgba(20, 24, 28, ${overlay})), url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };
}
