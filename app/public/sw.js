self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Remove caches from the previous offline-capable worker. This PWA is
  // intentionally online-only so votes can never bypass the shared API.
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((key) => key.startsWith("presidencia-duelo-app-"))
        .map((key) => caches.delete(key)),
    ),
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(fetch(request));
});
