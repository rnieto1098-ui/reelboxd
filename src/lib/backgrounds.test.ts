import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BACKGROUND_ID,
  backgroundStyle,
  isUploadedBackground,
  resolveBackground,
} from "./backgrounds.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com/backgrounds/u-1.png";

test("null resolves to the default preset", () => {
  const choice = resolveBackground(null);
  assert.equal(choice.kind, "preset");
  assert.equal(choice.kind === "preset" && choice.preset.id, DEFAULT_BACKGROUND_ID);
});

test("a stored preset resolves to that preset, an unknown one to the default", () => {
  const drive = resolveBackground("preset:drive-in");
  assert.equal(drive.kind === "preset" && drive.preset.id, "drive-in");
  const stale = resolveBackground("preset:no-such-thing");
  assert.equal(stale.kind === "preset" && stale.preset.id, DEFAULT_BACKGROUND_ID);
});

test("none and uploads resolve to their own kinds", () => {
  assert.deepEqual(resolveBackground("none"), { kind: "none" });
  assert.deepEqual(resolveBackground(BLOB), { kind: "upload", url: BLOB });
});

test("only uploads count as deletable blobs", () => {
  assert.equal(isUploadedBackground(BLOB), true);
  assert.equal(isUploadedBackground(null), false);
  assert.equal(isUploadedBackground("none"), false);
  assert.equal(isUploadedBackground("preset:film-strip"), false);
});

test("style: plain has none, uploads get the heavier overlay", () => {
  assert.equal(backgroundStyle("none"), undefined);
  assert.match(String(backgroundStyle(BLOB)?.backgroundImage), /0\.88.*u-1\.png/);
  assert.match(String(backgroundStyle(null)?.backgroundImage), /0\.6\b.*festival-lights\.webp/);
});
