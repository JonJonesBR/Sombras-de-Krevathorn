/* Krevathorn Service Worker — offline cache for the single-file game.
 *
 * Strategy:
 *   - navigation (./, ./index.html): NETWORK-FIRST com timeout de 3,5 s quando há
 *     cópia em cache. A freshly deployed release reaches players as soon as this
 *     worker activates (activation happens via skipWaiting on install +
 *     clients.claim). The cache is the fallback when offline or when the network
 *     is too slow; the fetch keeps running and refreshes the cache. Without a
 *     cached copy the network is awaited with no timeout. This is what makes
 *     updates show automatically.
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
 * Cache Storage entries with the krevathorn- prefix are cleaned on activate.
 */
const CACHE_VERSION = 'krevathorn-v112';
const CACHE_NAME = CACHE_VERSION;
const APP_SHELL = ['./', './index.html', './sprites.js', './manifest.webmanifest',
    './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
    './cutscenes/opening-1.webp', './cutscenes/opening-2.webp',
    './cutscenes/opening-3.webp', './cutscenes/opening-4.webp',
    './cutscenes/prophecy-vael.webp', './cutscenes/boss-guardian.webp',
    './cutscenes/ending-blood.webp', './cutscenes/ending-freedom.webp', './cutscenes/ending-peace.webp',
    './art/menu-bg.webp', './art/abyss-opening.webp', './art/camp-banner.webp',
    './art/gameover-veil.webp', './art/win-surface.webp',
    './art/biome-dungeon.webp', './art/biome-crypt.webp', './art/biome-lava.webp', './art/biome-forest.webp',
    './art/hero-warrior.webp', './art/hero-rogue.webp', './art/hero-mage.webp', './art/hero-elf.webp',
    './art/npc-guide.webp', './art/npc-merchant.webp', './art/npc-oracle.webp', './art/npc-eiran.webp',
    './art/boss-shadow_warden.webp', './art/boss-dark_lord.webp', './art/boss-death_herald.webp',
    './art/boss-stone_colossus.webp', './art/boss-specter.webp', './art/boss-soul_devourer.webp',
    './art/boss-bone_lord.webp', './art/boss-corrupted.webp', './art/boss-deep_demon.webp',
    './art/boss-magma_titan.webp', './art/boss-thorn_king.webp',
    './art/relic-vampiro.webp', './art/relic-ventos.webp', './art/relic-pedra.webp', './art/relic-alma.webp',
    './art/relic-regen.webp', './art/relic-trovao.webp', './art/relic-aguia.webp', './art/relic-espinhos.webp',
    './art/relic-mirror.webp', './art/relic-explosao.webp', './art/relic-furia.webp', './art/relic-berserker.webp',
    './art/relic-escudo_arcano.webp', './art/relic-oraculo.webp'];

// Pré-cache em itens independentes: `cache.addAll` é atômico e um único 404 deixava o
// app inteiro sem pré-cache. Aqui cada item falha sozinho; o restante entra no cache.
function _precache(cache) {
    return Promise.allSettled(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => {
            console.warn('[sw] pré-cache falhou para', url, err);
        })
    ));
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(_precache)
            .catch((err) => { console.warn('[sw] pré-cache falhou na instalação; segue sem pré-cache (navegação é network-first):', err); })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys
                .filter((k) => k.indexOf('krevathorn-') === 0 && k !== CACHE_NAME)
                .map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

const NAVIGATION_TIMEOUT_MS = 3500;

function cachedNavigation(req) {
    // O documento é sempre index.html (ou './'): tenta esses dois direto antes de varrer
    // todas as chaves do cache, que era um reduce sequencial e atrasava a resposta offline.
    return caches.match(req)
        .then((hit) => hit || caches.match('./index.html'))
        .then((hit) => hit || caches.match('./'))
        .then((hit) => hit || APP_SHELL.reduce((found, key) => found.then((f) => f || caches.match(key)), Promise.resolve(undefined)));
}

function navigationResponse(req, network) {
    return cachedNavigation(req).catch(() => undefined).then((cached) => {
        if (!cached) return network.catch(() => Response.error());
        const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAVIGATION_TIMEOUT_MS));
        return Promise.race([network.catch(() => cached), timeout]);
    });
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // same-origin only

    const isNavigation = req.mode === 'navigate' || req.destination === 'document' ||
        url.pathname === '/' || /\/index\.html$/.test(url.pathname);

    if (isNavigation) {
        // Network-first: new deployments must reach players as soon as the
        // refreshed worker is active. With a cached copy, a slow network
        // (lie-fi) yields to the cache after NAVIGATION_TIMEOUT_MS, while the
        // fetch keeps running in the background to refresh the cache.
        let storing = Promise.resolve();
        const network = fetch(req).then((res) => {
            if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
                const clone = res.clone();
                storing = caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return res;
        });
        event.waitUntil(network.then(() => storing, () => {}));
        event.respondWith(navigationResponse(req, network));
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
