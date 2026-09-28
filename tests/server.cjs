'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']]
]);

http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }
  const entry = files.get(pathname);
  if (!entry) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const [filename, contentType] = entry;
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': 'no-store',
    ...(filename === 'sw.js' ? { 'service-worker-allowed': '/' } : {})
  });
  fs.createReadStream(path.join(root, filename)).pipe(res);
}).listen(4173, '127.0.0.1');
