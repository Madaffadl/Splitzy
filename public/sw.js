// Splitzy minimal service worker.
// Strategy:
//   * App shell (start_url) — network-first with cache fallback so users with
//     a flaky connection still see the landing screen.
//   * Same-origin static assets (Next.js _next/static, /icon.svg, /manifest)
//     — stale-while-revalidate.
//   * Everything else (API calls, third-party) — passes through to the network.
//
// Bump CACHE_VERSION to invalidate old caches on deploy.

const CACHE_VERSION = "splitzy-v1";
const APP_SHELL = ["/", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never cache mutations.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Pass-through for cross-origin (e.g. Supabase, Gemini) and API routes.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation: network-first, fallback to cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
