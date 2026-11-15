// Flixtally's service worker. It does one job: when a page can't be loaded
// because the device is offline, show a friendly "you're offline" page
// instead of the browser's error screen.
//
// It deliberately caches nothing else. Every page, image and API call goes
// to the network exactly as it would without a service worker, so nobody is
// ever shown a stale diary or watchlist.

const CACHE = "flixtally-offline-v1";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ICON = "/icons/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([new Request(OFFLINE_URL, { cache: "reload" }), OFFLINE_ICON]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      // Lets the browser start the page request while this worker boots,
      // so having a service worker never makes a page load slower.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // The offline page's own icon, so it still shows with no connection.
  if (new URL(event.request.url).pathname === OFFLINE_ICON) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_ICON)) ?? Response.error();
      }),
    );
    return;
  }

  // Otherwise only full page loads. Everything else is left to the browser.
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }
    })(),
  );
});
