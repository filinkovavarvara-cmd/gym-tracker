// Serve only application assets, never backups, credentials, or helper scripts.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png'
};
const assets = new Set(['index.html', 'app.js', 'import.js', 'style.css', 'sw.js', 'manifest.json', 'favicon.png', 'icon-192.png', 'icon-512.png']);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!assets.has(name) && !/^icons\/[\w-]+\.svg$/.test(name)) {
    res.writeHead(404);
    return res.end();
  }
  fs.readFile(path.join(root, name), (error, data) => {
    if (error) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', types[path.extname(name)]);
    res.end(data);
  });
}).listen(4173, '127.0.0.1');