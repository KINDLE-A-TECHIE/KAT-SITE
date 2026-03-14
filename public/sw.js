const RUNTIME_CACHE = "kat-runtime-v2";
const RUNTIME_CACHE_LIMIT = 60;

// Fix 11 — derive static cache name from Next.js build ID so stale caches
// are automatically evicted whenever a new build is deployed.
let _staticCachePromise = null;

function getStaticCacheName() {
  if (!_staticCachePromise) {
    _staticCachePromise = fetch("/_next/BUILD_ID")
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((id) => `kat-static-${id.trim()}`)
      .catch(() => "kat-static-fallback");
  }
  return _staticCachePromise;
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) {
    await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
  }
}

const APP_SHELL_URLS = ["/", "/offline", "/manifest.webmanifest", "/kindle-a-techie.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    getStaticCacheName().then(async (cacheName) => {
      const cache = await caches.open(cacheName);
      await cache.addAll(APP_SHELL_URLS);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    getStaticCacheName().then(async (currentStatic) => {
      const keys = await caches.keys();
      // Delete all stale kat-static-* caches and any other unknown caches
      await Promise.all(
        keys
          .filter((key) => key !== currentStatic && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

function isStaticAssetRequest(request, url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    ["script", "style", "image", "font", "worker"].includes(request.destination)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const runtimeCache = await caches.open(RUNTIME_CACHE);
          runtimeCache.put(request, networkResponse.clone());
          trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT);
          return networkResponse;
        } catch {
          const staticCacheName = await getStaticCacheName();
          const staticCache = await caches.open(staticCacheName);
          const offlinePage = await staticCache.match("/offline");
          if (offlinePage) {
            return offlinePage;
          }
          const homepage = await staticCache.match("/");
          return homepage || Response.error();
        }
      })(),
    );
    return;
  }

  // Fix 10 — cache-first for static assets (/_next/static/* are content-addressed
  // and never change, so serving from cache immediately is safe and faster).
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      (async () => {
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        // Serve from cache immediately if available
        const cached = await runtimeCache.match(request);
        if (cached) return cached;
        // Also check app-shell cache (covers logo, manifest, etc.)
        const staticCacheName = await getStaticCacheName();
        const staticCache = await caches.open(staticCacheName);
        const shellCached = await staticCache.match(request);
        if (shellCached) return shellCached;
        // Cache miss — fetch from network, store, then return
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            runtimeCache.put(request, networkResponse.clone());
            trimCache(RUNTIME_CACHE, RUNTIME_CACHE_LIMIT);
          }
          return networkResponse;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
});
