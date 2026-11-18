import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceSearchUrl, watchLink } from "./couch/providerLinks.ts";

test("known services get a search link with the title encoded", () => {
  assert.equal(serviceSearchUrl(8, "Heat & Dust"), "https://www.netflix.com/search?q=Heat%20%26%20Dust");
  assert.ok(serviceSearchUrl(9, "Heat")!.startsWith("https://www.amazon.com/"));
});

test("services without a working search fall back to the TMDB watch page", () => {
  assert.equal(serviceSearchUrl(337, "Heat"), null); // Disney+
  assert.deepEqual(watchLink(337, "Heat", "https://www.themoviedb.org/movie/949/watch"), {
    href: "https://www.themoviedb.org/movie/949/watch",
    direct: false,
  });
  assert.equal(watchLink(337, "Heat", null), null);
  assert.equal(watchLink(8, "Heat", null)?.direct, true);
});
