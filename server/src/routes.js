// HTTP routes: same contract as tid-worker routes.rs.
// GET /api/view, /api/areas, /api/stations, POST/DELETE /api/push/subscriptions.
import { createHash } from 'node:crypto';
import { TRAFFIC_TTL_MS, TRAINS_TTL_MS } from './config.js';
import { fetchTrainsFor, getDoc } from './upstream.js';
import { ensureSnapshot, isoNow } from './scheduler.js';

export function hashId(endpoint) {
  return createHash('sha256').update(endpoint, 'utf8').digest('hex').slice(0, 32);
}

function query(url, key) {
  const v = url.searchParams.get(key);
  return v === null ? null : v;
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

function text(res, status, msg) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(msg);
}
async function handleView(ctx, url, res) {
  const { config, store, core } = ctx;
  const snap = await ensureSnapshot(ctx);
  const viewed = (query(url, 'line') ?? '').trim() || null;
  if (viewed && !snap.orders?.[viewed]) return text(res, 400, 'unknown line');
  const stationQ = (query(url, 'station') ?? '').trim();
  const pass = query(url, 'pass') ?? 'hide';
  const areaQ = (query(url, 'area') ?? '').trim();
  const scope = viewed ? Object.keys(snap.orders ?? {}) : config.scopeLines;
  const area = areaQ || config.fixedArea;
  const payloads = await fetchTrainsFor(config.origin, store, scope, TRAINS_TTL_MS);
  const trafficDoc = await getDoc(
    config.origin,
    store,
    `area_${area}_trafficinfo.json`,
    TRAFFIC_TTL_MS,
  );
  let body;
  try {
    body = core.buildViewJson(
      JSON.stringify(snap),
      JSON.stringify({
        scopeLines: config.scopeLines,
        primaryLine: config.fixedLine,
        fixedStation: config.fixedStation,
        fixedArea: config.fixedArea,
        viewedLine: viewed,
        stationQuery: stationQ,
        pass,
        areaQuery: areaQ,
        payloads,
        serverTime: isoNow(),
        colorMap: ctx.colorMap,
        trafficDoc: trafficDoc ?? null,
      }),
    );
  } catch (err) {
    return text(res, 500, `view failed: ${err?.message ?? err}`);
  }
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function handleAreas(ctx, res) {
  const snap = await ensureSnapshot(ctx);
  json(res, 200, snap.areas ?? {});
}

async function handleStations(ctx, url, res) {
  const snap = await ensureSnapshot(ctx);
  const line = (query(url, 'line') ?? '').trim();
  if (!line) return text(res, 400, 'missing line');
  const order = snap.orders?.[line];
  const stations = snap.lines?.[line];
  if (!order || !stations) return text(res, 400, 'unknown line');
  const list = order
    .filter((code) => stations[code])
    .map((code) => {
      const name = String(stations[code]?.name ?? '').trim();
      return { code, name: name || code };
    });
  json(res, 200, { line, stations: list });
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleSubscribe(ctx, req, url, res) {
  const { store } = ctx;
  if (req.method === 'POST') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return text(res, 400, 'invalid json');
    }
    const endpoint = body?.subscription?.endpoint;
    const keys = body?.subscription?.keys ?? {};
    if (!endpoint || !keys.p256dh || !keys.auth || !body?.station) {
      return text(res, 400, 'missing fields');
    }
    const id = hashId(String(endpoint));
    store.upsertSubscription({
      id,
      endpoint: String(endpoint),
      p256dh: String(keys.p256dh),
      auth: String(keys.auth),
      stationCode: String(body.station),
      prefsJson: typeof body.prefs_json === 'string' ? body.prefs_json : '{}',
      createdAt: isoNow(),
    });
    return json(res, 200, { ok: true, id });
  }
  if (req.method === 'DELETE') {
    const id = (query(url, 'id') ?? '').trim();
    if (!id) return text(res, 400, 'missing id');
    store.deleteSubscription(id);
    return json(res, 200, { ok: true });
  }
  return text(res, 405, 'method not allowed');
}

export async function routeApi(ctx, req, url, res) {
  const path = url.pathname;
  try {
    if (req.method === 'GET' && path === '/api/view') return await handleView(ctx, url, res);
    if (req.method === 'GET' && path === '/api/areas') return await handleAreas(ctx, res);
    if (req.method === 'GET' && path === '/api/stations') return await handleStations(ctx, url, res);
    if (path === '/api/push/subscriptions') return await handleSubscribe(ctx, req, url, res);
    return null;
  } catch (err) {
    console.error('api failed:', path, err?.message ?? err);
    return text(res, 500, 'internal error');
  }
}
