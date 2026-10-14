// Kleine statische server voor het prototype: geen afhankelijkheden, geen build.
// /planner en /voorbeeld wijzen naar src/, zodat de browser dezelfde planlogica draait als de tests.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const poort = Number(process.env.PORT) || 5173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  let pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pad === '/') pad = '/vandaag.html';
  const map = pad.startsWith('/planner/') ? 'src' : pad.startsWith('/voorbeeld/') ? 'src' : 'frontend';
  const bestand = normalize(join(root, map, pad));
  if (!bestand.startsWith(join(root, map))) { res.writeHead(403).end(); return; }
  try {
    res.writeHead(200, { 'content-type': types[extname(bestand)] || 'application/octet-stream' }).end(await readFile(bestand));
  } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Niet gevonden'); }
}).listen(poort, () => console.log(`LIFE-prototype op http://localhost:${poort}`));
