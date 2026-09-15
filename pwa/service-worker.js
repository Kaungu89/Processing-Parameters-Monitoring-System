const CACHE_NAME = "mimbula-telemetry-cache-v1";
const ASSETS_TO_CACHE = [
  "/pwa/index.html",
  "/pwa/style.css",
  "/pwa/script.js",
  "/pwa/manifest.json",
  "/pwa/assets/logo.svg",
  "/pwa/assets/icons/icon-192x192.png",
  "/pwa/assets/icons/icon-512x512.png"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching static assets...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("[Service Worker] Cache addall failed (some files might be generated during active flow):", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing stale cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor for offline operations
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and exclude dynamic API routes from service worker caching
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Dynamically add new successful assets to cache
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback for index.html
        if (event.request.mode === "navigate") {
          return caches.match("/pwa/index.html");
        }
      });
    })
  );
});
