// A tiny static server for the demo page.
//
// Deliberately dependency-free: "zero dependencies" is a promise this package
// makes to its users, and it should hold for people working on it too.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = url.pathname === '/' ? 'demo/index.html' : url.pathname.slice(1);

  // Keep requests inside the repo
  const file = join(ROOT, normalize(rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Demo running at http://localhost:${PORT}/?edit=true`);
  console.log('Run "npm run dev" in another terminal to rebuild on save.');
});
