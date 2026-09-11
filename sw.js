/* Krevathorn Service Worker — offline cache for the single-file game.
 *
 * Strategy:
 *   - navigation (./, ./index.html): NETWORK-FIRST. A freshly deployed release
 *     reaches players as soon as this worker activates (activation happens via
 *     skipWaiting on install + clients.claim), and the cache is only the
 *     offline fallback. This is what makes updates show automatically.
 *   - other same-origin GETs: stale-while-revalidate (cache-first, refresh in
 *     background) — the app is a single HTML file, so there is little else.
 *   - offline: the cache serves the game.
 *
 * Release procedure (keep the two in sync):
 *   - bump CACHE_VERSION here AND window.UPDATE_LOG.current in index.html to
 *     the same suffix (e.g. 'krevathorn-v10' / 'v10');
 *   - add a changelog entry to UPDATE_LOG.entries (the game announces new
 *     versions once, per user, via the "Novidades" panel);
 *   - the SW update itself is picked up fast because index.html registers with
 *     { updateViaCache: 'none' }, then skipWaiting + clients.claim take over
 *     and the page reloads once.
 * Save data lives in localStorage and is NEVER touched by this worker — only
 * Cache Storage entries are cleaned (old caches deleted on activate).
 */
const CACHE_VERSION = 'krevathorn-v14';
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

    const isNavigation = req.mode === 'navigate' || req.destination === 'document' ||
        url.pathname === '/' || /\/index\.html$/.test(url.pathname);

    if (isNavigation) {
        // Network-first: new deployments must reach players as soon as the
        // refreshed worker is active; the cache is only the offline fallback.
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req)) // offline: cached copy
        );
        return;
    }

    // Stale-while-revalidate for everything else.
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