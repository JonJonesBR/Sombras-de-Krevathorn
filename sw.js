/* Krevathorn Service Worker — offline cache for the single-file game.
 *
 * Strategy: stale-while-revalidate. The app is one HTML file, so:
 *   - first load (online): network, then cache.
 *   - subsequent loads: cache instantly, refresh the cache in the background.
 *   - offline: cache serves the game.
 * Bump CACHE_VERSION when you publish a release you want to force-refresh.
 */
const CACHE_VERSION = 'krevathorn-v4';
const CACHE_NAME = CACHE_VERSION;
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // same-origin only

    // Stale-while-revalidate: answer from cache, refresh in background.
    event.respondWith(
        caches.match(req).then((cached) => {
            const network = fetch(req)
                .then((res) => {
                    if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached); // offline: fall back to cache
            return cached || network;
        })
    );
});
