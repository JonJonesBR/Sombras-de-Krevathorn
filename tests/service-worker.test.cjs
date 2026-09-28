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

test('service worker and application announce the same release version', () => {
  const swVersion = swSource.match(/const CACHE_VERSION = '([^']+)'/);
  const appVersion = htmlSource.match(/current:\s*'v(\d+)'/);
  assert.ok(swVersion, 'service worker cache version exists');
  assert.ok(appVersion, 'application update log version exists');
  assert.equal(swVersion[1], `krevathorn-v${appVersion[1]}`);
  assert.match(htmlSource, new RegExp("v: 'v" + appVersion[1] + "'.*update.entry.v" + appVersion[1] + "\\.title", 's'));
  for (const key of ['title', 'l1', 'l2', 'l3']) {
    const keyPattern = new RegExp("'update\\.entry\\.v" + appVersion[1] + "\\." + key + "':", 'g');
    assert.equal((htmlSource.match(keyPattern) || []).length, 3, `release ${key} is translated in pt/en/es`);
  }
});
