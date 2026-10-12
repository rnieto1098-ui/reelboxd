import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FALLBACK_BACKGROUND_ID,
  MATCH_TAB,
  backgroundStyle,
  isUploadedBackground,
  pickerSelection,
  resolveBackground,
  tabBackground,
} from "./backgrounds.ts";

const BLOB = "https://abc.public.blob.vercel-storage.com/backgrounds/u-1.png";

test("null matches each tab, falling back on pages without their own", () => {
  const id = (path: string) => {
    const choice = resolveBackground(null, path);
    return choice.kind === "preset" && choice.preset.id;
  };
  assert.equal(id("/"), FALLBACK_BACKGROUND_ID);
  assert.equal(id("/movie/603"), FALLBACK_BACKGROUND_ID);
  assert.equal(id("/watchlist"), "movie-night");
  assert.equal(id("/lists/abc123"), "planning-desk");
  assert.equal(id("/profile/someone"), "frame-wall");
  // Prefix match is on whole segments, not string starts.
  assert.equal(tabBackground("/crewmates").id, FALLBACK_BACKGROUND_ID);
});

test("a chosen preset applies on every tab", () => {
  for (const path of ["/", "/watchlist", "/crew"]) {
    const choice = resolveBackground("preset:drive-in", path);
    assert.equal(choice.kind === "preset" && choice.preset.id, "drive-in");
  }
});

test("picker selection", () => {
  assert.equal(pickerSelection(null), MATCH_TAB);
  assert.equal(pickerSelection("preset:festival-lights"), "festival-lights");
  assert.equal(pickerSelection("preset:no-such-thing"), MATCH_TAB);
  assert.equal(pickerSelection("none"), "none");
  assert.equal(pickerSelection(BLOB), "upload");
});

test("a stored preset resolves to that preset, an unknown one to the tab's", () => {
  const drive = resolveBackground("preset:drive-in");
  assert.equal(drive.kind === "preset" && drive.preset.id, "drive-in");
  const stale = resolveBackground("preset:no-such-thing", "/challenges");
  assert.equal(stale.kind === "preset" && stale.preset.id, "summit-trail");
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
