// MinePilot offline service worker
// ------------------------------------------------------------------
// Strategy: network-first, falling back to cache, for page/asset
// requests only. API calls (/api/, /ws/) are deliberately left
// untouched here -- those are handled by the app's own localStorage-based
// offline queue (src/lib/offlineQueue.ts), which has more precise control
// over merging and retrying individual actions than a generic cache ever
// could. This worker's only job is making sure the app shell itself
// (HTML/JS/CSS) still loads with zero connectivity.

const CACHE_NAME = "minepilot-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiOrSocket(url) {
  return url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for pages/assets. Everything else
  // (API calls, WebSocket upgrades, cross-origin requests, non-GET methods)
  // passes straight through untouched.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isApiOrSocket(url)
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful, basic (non-opaque) responses.
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Nothing cached for this exact request and no network -- if it's
          // a page navigation, fall back to whatever shell page we do have
          // cached (e.g. the field page itself) rather than a hard failure.
          if (event.request.mode === "navigate") {
            return caches.match("/field");
          }
          return new Response("", { status: 504, statusText: "Offline" });
        })
      )
  );
});