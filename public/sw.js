// Chatlas Attraction Explorer service worker (PB20).
//
// Scope: makes previously-viewed attraction pages, searches, photos, and map
// tiles available offline/on a weak connection. Never intercepts non-GET
// requests or routes outside this module (auth, reviews, etc. are left to the
// browser's normal network handling so they fail their own way, not this
// worker's way).
//
// Bump the cache version whenever the caching strategy changes so old caches
// get cleaned up on activate.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `chatlas-static-${CACHE_VERSION}`;
const PAGES_CACHE = `chatlas-pages-${CACHE_VERSION}`;
const API_CACHE = `chatlas-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `chatlas-images-${CACHE_VERSION}`;
const MAPS_CACHE = `chatlas-maps-${CACHE_VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, API_CACHE, IMAGE_CACHE, MAPS_CACHE];

const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([new Request(OFFLINE_URL, { cache: "reload" }), new Request("/", { cache: "reload" })])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isImageRequest(url) {
  return url.hostname === "res.cloudinary.com" || url.pathname === "/_next/image";
}

function isMapsRequest(url) {
  return (
    url.hostname === "maps.googleapis.com" ||
    url.hostname === "maps.gstatic.com" ||
    /^khms\d\.googleapis\.com$/.test(url.hostname)
  );
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(PAGES_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cachedPage = await caches.match(request);
    return cachedPage || caches.match(OFFLINE_URL);
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkPromise);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept writes (POST/PUT/DELETE) — those belong to whichever
  // module owns them and should fail/succeed on the network's own terms.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/attractions")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (isMapsRequest(url)) {
    // NOTE: only caches tiles/scripts already fetched during normal use (the
    // same thing the browser's HTTP cache would do), not bulk pre-fetching.
    // Review against Google Maps Platform ToS before relying on this beyond
    // coursework.
    event.respondWith(staleWhileRevalidate(request, MAPS_CACHE));
    return;
  }

  // Everything else (other modules' routes/APIs): let the browser handle it.
});
