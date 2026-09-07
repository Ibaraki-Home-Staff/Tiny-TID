// Tiny-TID SORAHOST backend: same /api contract as the Cloudflare worker,
// SQLite instead of D1, in-process scheduler instead of cron triggers.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { config } from './config.js';
import { loadCore, loadColorText, publicDir } from './core.js';
import { openStore } from './store.js';
import { routeApi } from './routes.js';
import { ensureSnapshot, startScheduler } from './scheduler.js';
import { initPush } from './push.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(root, pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = resolve(root, normalize(rel));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end('forbidden');
    return true;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const core = loadCore();
  const store = openStore(resolve(config.dataDir));
  const colorMap = JSON.parse(core.parseColorMapJson(loadColorText()));
  const push = initPush(config);
  const ctx = { config, store, core, colorMap, push };
  const root = publicDir();

  // Fail fast when upstream is unreachable instead of serving 500s.
  await ensureSnapshot(ctx);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const handled = await routeApi(ctx, req, url, res);
        if (!handled) {
          res.writeHead(404).end('not found');
        }
        return;
      }
      if (!(await serveStatic(root, url.pathname, res))) {
        res.writeHead(404).end('not found');
      }
    } catch (err) {
      console.error('request failed:', err?.message ?? err);
      if (!res.headersSent) res.writeHead(500).end('internal error');
      else res.end();
    }
  });

  startScheduler(ctx);
  server.listen(config.port, config.host, () => {
    console.log(`tiny-tid server on http://${config.host}:${config.port} (data: ${resolve(config.dataDir)})`);
  });
}

await main();
