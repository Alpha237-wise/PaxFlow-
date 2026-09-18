// PaxFlow service worker — app-shell offline caching (§21 step 13, §16.1).
//
// Strategy: network-falling-back-to-cache for same-origin GET requests
// only. Cross-origin requests (Supabase) are never intercepted, so this
// never risks caching or interfering with API calls. Pages/assets are
// cached as they're actually fetched (no attempt to precache every future
// crossing id) — the operational screens read their real data from
// IndexedDB client-side, so a cached shell never serves stale crossing
// data, only the (data-free) page wrapper.
const CACHE_NAME = "paxflow-shell-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ignoreVary: true on both match() calls below — confirmed necessary
  // 2026-09-18 by an actual offline test that failed even with an
  // active, controlling service worker and a page genuinely cached
  // moments earlier. Next.js's App Router sends `Vary: rsc,
  // next-router-state-tree, next-router-prefetch,
  // next-router-segment-prefetch, Accept-Encoding` on every page/document
  // response, and the Cache API's default match() respects Vary — so a
  // fresh hard navigation's header values (a real offline reload, or this
  // test's page.goto) rarely match whatever RSC/router-state header
  // values happened to be present on the request that originally
  // populated the cache entry, and match() silently misses even though
  // the exact same URL is sitting right there in the cache. Without
  // ignoreVary, that miss cascades to the `?? caches.match("/")` fallback
  // missing too, respondWith() resolves with undefined, and the browser
  // shows its own offline error page instead of anything this app
  // controls — this is what "offline-first" actually broke on, not
  // network speed.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const exact = await cache.match(request, { ignoreVary: true });
        if (exact) return exact;

        // A crossing created while offline has a brand-new id the SW could
        // never have precached (it didn't exist yet). Falling straight back
        // to "/" would serve Home's shell for a /crossings/[id] URL — the
        // wrong component tree entirely. Prefer any OTHER cached
        // /crossings/[id] page instead: same route, same component tree,
        // and crossing-detail.tsx reads the real id from the live URL via
        // useParams() rather than trusting whatever payload the cached
        // shell happened to be rendered with (field report 2026-09-18).
        const isCrossingDetailUrl =
          /^\/crossings\/[^/]+$/.test(url.pathname) && url.pathname !== "/crossings/new";
        if (isCrossingDetailUrl) {
          const keys = await cache.keys();
          const otherCrossingPage = keys.find((key) => {
            const keyUrl = new URL(key.url);
            return (
              keyUrl.origin === url.origin &&
              /^\/crossings\/[^/]+$/.test(keyUrl.pathname) &&
              keyUrl.pathname !== "/crossings/new"
            );
          });
          if (otherCrossingPage) {
            const cachedCrossingPage = await cache.match(otherCrossingPage, { ignoreVary: true });
            if (cachedCrossingPage) return cachedCrossingPage;
          }
        }

        return cache.match("/", { ignoreVary: true });
      }),
  );
});
