'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('service worker activation only removes obsolete Krevathorn caches', async () => {
  const handlers = new Map();
  const deleted = [];
  const cacheNames = ['krevathorn-v17', 'krevathorn-v18', 'other-app-v1'];
  const context = {
    self: {
      location: { origin: 'https://game.example' },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {}
    },
    caches: {
      keys: async () => cacheNames,
      delete: async (name) => { deleted.push(name); return true; },
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      match: async () => undefined
    },
    URL,
    fetch: async () => ({ ok: true, type: 'basic', clone() { return this; } })
  };
  vm.runInNewContext(swSource, context, { filename: 'sw.js' });
  let activation;
  handlers.get('activate')({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['krevathorn-v17', 'krevathorn-v18']);
});

test('service worker falls back to the cached shell when a navigation fetch fails offline', async () => {
  const handlers = new Map();
  const matched = [];
  const cachedShell = { url: 'https://game.example/index.html', body: 'cached Krevathorn shell' };
  const context = {
    self: {
      location: { origin: 'https://game.example' },
      clients: { claim: async () => {} },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => {}
    },
    caches: {
      keys: async () => [],
      delete: async () => true,
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      match: async (request) => { matched.push(request.url); return cachedShell; }
    },
    URL,
    fetch: async () => { throw new TypeError('offline'); }
  };
  vm.runInNewContext(swSource, context, { filename: 'sw.js' });

  let responsePromise;
  handlers.get('fetch')({
    request: { method: 'GET', mode: 'navigate', destination: 'document', url: cachedShell.url },
    respondWith(promise) { responsePromise = promise; }
  });

  assert.equal(await responsePromise, cachedShell);
  assert.deepEqual(matched, [cachedShell.url]);
});

test('service worker and application announce the same release version', () => {
  const swVersion = swSource.match(/const CACHE_VERSION = '([^']+)'/);
  const appVersion = htmlSource.match(/current:\s*'v(\d+)'/);
  assert.ok(swVersion, 'service worker cache version exists');
  assert.ok(appVersion, 'application update log version exists');
  assert.equal(swVersion[1], `krevathorn-v${appVersion[1]}`);
  assert.match(htmlSource, new RegExp("v: 'v" + appVersion[1] + "'.*update.entry.v" + appVersion[1] + "\\.title", 's'));
  const releaseEntry = htmlSource.match(new RegExp("\\{ v: 'v" + appVersion[1] + "'([\\s\\S]*?)\\n\\s*\\}", 'm'));
  assert.ok(releaseEntry, 'current release has a changelog entry');
  const lineKeys = [...releaseEntry[1].matchAll(/update\.entry\.v\d+\.l\d+/g)]
    .map(([key]) => key.slice(key.lastIndexOf('.') + 1));
  for (const key of ['title', ...new Set(lineKeys)]) {
    const keyPattern = new RegExp("'update\\.entry\\.v" + appVersion[1] + "\\." + key + "':", 'g');
    assert.equal((htmlSource.match(keyPattern) || []).length, 3, `release ${key} is translated in pt/en/es`);
  }
});
