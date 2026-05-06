/* Tiny static file server for previewing the new CPDSE website locally
 * (Jekyll templating is mocked manually in _preview/people-preview.html)
 *
 * Run:  node _preview/server.cjs
 */
const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8770;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.txt':  'text/plain; charset=utf-8',
};

/* Map nice URLs to mocked preview pages so we can navigate between them. */
const ROUTES = {
  '/':         '/_preview/people-preview.html',
  '/people':   '/_preview/people-preview.html',
  '/people/':  '/_preview/people-preview.html',
  '/publications':  '/_preview/publications-preview.html',
  '/publications/': '/_preview/publications-preview.html',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath in ROUTES) urlPath = ROUTES[urlPath];

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found: ' + urlPath); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`CPDSE-website-new preview running at http://localhost:${PORT}/`);
  console.log(`(serving ${ROOT})`);
});
