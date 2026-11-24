import { test } from "node:test";
import assert from "node:assert/strict";
import { AVATAR_PRESETS, avatarSrc, defaultAvatar, isPresetAvatar } from "./avatars.ts";

const UPLOAD = "https://abc.public.blob.vercel-storage.com/avatars/u-1.png";

test("default avatar: the same username always gets the same preset", () => {
  assert.equal(defaultAvatar("discovertest").id, defaultAvatar("discovertest").id);
  assert.equal(defaultAvatar("DiscoverTest").id, defaultAvatar("discovertest").id);
  assert.ok(AVATAR_PRESETS.includes(defaultAvatar("someone")));
});

test("default avatar: different usernames spread across the presets", () => {
  const ids = new Set(["ana", "ben", "cy", "dee", "eli", "fay", "gus", "hal", "ivy", "jo"].map((u) => defaultAvatar(u).id));
  assert.ok(ids.size > 2);
});

test("avatarSrc: a photo or chosen preset wins, otherwise the default preset", () => {
  assert.equal(avatarSrc(UPLOAD, "ana"), UPLOAD);
  assert.equal(avatarSrc("/avatars/popcorn.webp", "ana"), "/avatars/popcorn.webp");
  assert.equal(avatarSrc(null, "ana"), defaultAvatar("ana").src);
});

test("isPresetAvatar tells presets from uploads", () => {
  assert.equal(isPresetAvatar("/avatars/popcorn.webp"), true);
  assert.equal(isPresetAvatar(UPLOAD), false);
  assert.equal(isPresetAvatar(null), false);
});
