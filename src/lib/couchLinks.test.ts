import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceSearchUrl, watchLink, watchesOnPrimeVideo } from "./couch/providerLinks.ts";

test("known services get a search link with the title encoded", () => {
  assert.equal(serviceSearchUrl(8, "Heat & Dust"), "https://www.netflix.com/search?q=Heat%20%26%20Dust");
  assert.equal(serviceSearchUrl(15, "Heat"), "https://www.hulu.com/search?q=Heat");
});

test("Prime Video, Starz, HBO Max, MGM+ and AMC+ open Prime Video's search", () => {
  for (const id of [9, 2100, 43, 1899, 1825, 34, 583, 526, 528]) {
    assert.equal(serviceSearchUrl(id, "Heat"), "https://www.primevideo.com/search?phrase=Heat", String(id));
  }
  assert.deepEqual(watchLink({ id: 1899, name: "HBO Max" }, "Heat", null), {
    href: "https://www.primevideo.com/search?phrase=Heat",
    direct: true,
    label: "Prime Video",
  });
});

test("any other Amazon Channel opens Prime Video too", () => {
  assert.equal(watchesOnPrimeVideo(204, "Shudder Amazon Channel"), true);
  assert.equal(watchesOnPrimeVideo(8, "Netflix"), false);
});

test("services without a working search fall back to the TMDB watch page", () => {
  assert.equal(serviceSearchUrl(337, "Heat"), null); // Disney+
  assert.deepEqual(watchLink({ id: 337, name: "Disney Plus" }, "Heat", "https://www.themoviedb.org/movie/949/watch"), {
    href: "https://www.themoviedb.org/movie/949/watch",
    direct: false,
    label: "Disney Plus",
  });
  assert.equal(watchLink({ id: 337, name: "Disney Plus" }, "Heat", null), null);
  assert.equal(watchLink({ id: 8, name: "Netflix" }, "Heat", null)?.label, "Netflix");
});

test("Sony Pictures Core opens Prime Video, where its channel lives", () => {
  assert.equal(watchesOnPrimeVideo(2745, "Sony Pictures Core"), true);
  assert.equal(watchLink({ id: 2745, name: "Sony Pictures Core" }, "Heat", null)?.label, "Prime Video");
});
