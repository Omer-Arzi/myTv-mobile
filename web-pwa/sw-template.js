// Generated at build time by scripts/build-web-pwa.js — do not edit dist/sw.js
// directly, edit this template instead.
//
// Strategy: only ever cache same-origin static build output (the app shell:
// HTML/JS/CSS/images produced by `expo export -p web`). Requests to any other
// origin (the API server) are never intercepted — this app's data is live,
// user-specific, and mutated constantly (mark-watched, sync, etc.), so
// serving it from a cache would show stale or wrong state. Offline support
// here means "the app shell loads and renders", not "the API works offline".
const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = `mytv-shell-${CACHE_VERSION}`;
const PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch API requests

  // Navigations (e.g. reloading mid-route) always get the cached app shell —
  // this is a client-side-routed SPA, there is no per-route server HTML.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static build assets are content-hashed by Metro — cache-first is safe,
  // a new export ships a new URL and a new CACHE_VERSION.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
