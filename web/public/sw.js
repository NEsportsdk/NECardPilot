const CACHE_PREFIX = "vallective-offline";
const CACHE_NAME = `${CACHE_PREFIX}-v3`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(new Request(request, { cache: "no-store" })).catch(async () => {
      const fallback = await caches.match(OFFLINE_URL);

      return fallback ?? Response.error();
    })
  );
});
