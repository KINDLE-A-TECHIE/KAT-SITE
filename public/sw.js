const RUNTIME_CACHE = "kat-runtime-v3";
const API_CACHE = "kat-api-v1"; // cached lesson-content GETs, so a visited lesson reads offline
const IMAGE_CACHE = "kat-img-v1"; // cross-origin lesson images (R2), so visuals show offline
const RUNTIME_CACHE_LIMIT = 60;
const API_CACHE_LIMIT = 80;
const IMAGE_CACHE_LIMIT = 150;

// Derive static cache name from Next.js build ID so stale caches auto-evict on deploy.
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
      const keep = new Set([currentStatic, RUNTIME_CACHE, API_CACHE, IMAGE_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    }),
  );
});

// The app can ask the SW to pre-download content for a unit so it reads offline later. The page posts
// { type: "PRECACHE", unitId, apiUrls: [...], imageUrls: [...] }; we warm the API and image caches.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "PRECACHE") return;
  event.waitUntil(
    (async () => {
      const apiCache = await caches.open(API_CACHE);
      const imgCache = await caches.open(IMAGE_CACHE);
      await Promise.all([
        ...(data.apiUrls || []).map((u) =>
          fetch(u, { credentials: "include" })
            .then((res) => (res.ok ? apiCache.put(u, res.clone()) : null))
            .catch(() => null),
        ),
        ...(data.imageUrls || []).map((u) =>
          fetch(u, { mode: "no-cors" })
            .then((res) => (res.ok || res.type === "opaque" ? imgCache.put(u, res.clone()) : null))
            .catch(() => null),
        ),
      ]);
      await trimCache(API_CACHE, API_CACHE_LIMIT);
      await trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
      // Tell the requesting client we are done, so it can flip its "downloaded" state.
      if (event.source) event.source.postMessage({ type: "PRECACHE_DONE", unitId: data.unitId });
    })(),
  );
});

function isStaticAssetRequest(request, url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    ["script", "style", "image", "font", "worker"].includes(request.destination)
  );
}

// Read-only lesson CONTENT endpoints worth caching for offline reading. Deliberately narrow: only GETs
// that serve curriculum content, never auth, never anything a mutation touches. The lesson-content GET
// is `/api/curriculum/lessons/<id>` exactly (no trailing /complete, /contents, /run segments).
function isCacheableApiRead(url) {
  return (
    url.pathname === "/api/school/learn" ||
    /^\/api\/curriculum\/lessons\/[^/]+$/.test(url.pathname)
  );
}

// Serve cache immediately, refresh in the background. Best for lesson content: instant + offline-safe,
// and self-heals to the latest version the next time the pupil is online.
async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) {
        cache.put(request, res.clone());
        trimCache(cacheName, limit);
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    // Cache successful same-origin responses and opaque cross-origin ones (images fetched no-cors).
    if (res.ok || res.type === "opaque") {
      cache.put(request, res.clone());
      trimCache(cacheName, limit);
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: only cache IMAGES (R2 lesson images, logos), so lesson visuals survive offline.
  // Everything else cross-origin (analytics, CDNs we do not control) stays network-only.
  if (url.origin !== self.location.origin) {
    if (request.destination === "image") {
      event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
    }
    return;
  }

  // Same-origin API: cache the read-only content endpoints, leave everything else (mutations, auth,
  // per-user data) network-only so we never serve stale writes or another user's actions.
  if (url.pathname.startsWith("/api/")) {
    if (isCacheableApiRead(url)) {
      event.respondWith(staleWhileRevalidate(request, API_CACHE, API_CACHE_LIMIT));
    }
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
          // Offline: serve THIS page from cache if we have it (a lesson visited before now reads
          // offline), and only fall back to the generic offline page when we do not.
          const runtimeCache = await caches.open(RUNTIME_CACHE);
          const cachedPage = await runtimeCache.match(request);
          if (cachedPage) return cachedPage;
          const staticCacheName = await getStaticCacheName();
          const staticCache = await caches.open(staticCacheName);
          const offlinePage = await staticCache.match("/offline");
          if (offlinePage) return offlinePage;
          const homepage = await staticCache.match("/");
          return homepage || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets (/_next/static/* are content-addressed and never change): cache-first.
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      (async () => {
        const runtimeCache = await caches.open(RUNTIME_CACHE);
        const cached = await runtimeCache.match(request);
        if (cached) return cached;
        const staticCacheName = await getStaticCacheName();
        const staticCache = await caches.open(staticCacheName);
        const shellCached = await staticCache.match(request);
        if (shellCached) return shellCached;
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
