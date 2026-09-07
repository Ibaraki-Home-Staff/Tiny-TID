// Upstream fetching: memory cache + SQLite stale fallback + failure cooldown.
// Mirrors tid-worker upstream.rs: a failed key cools down 30s so an outage
// doesn't turn into sustained per-TTL hammering.
import { TRAFFIC_TTL_MS } from './config.js';

const COOLDOWN_MS = 30_000;
const mem = new Map(); // path -> { ts, bytes }
const cooldownUntil = new Map(); // path -> epoch ms

async function fetchUpstream(origin, path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`${origin}/api/v3/${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`upstream ${res.status} for ${path}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

function parse(bytes) {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    return null;
  }
}

function staleParsed(store, path) {
  const stale = store.staleGet(`stale:${path}`);
  return stale ? parse(stale) : null;
}

export async function getDoc(origin, store, path, ttlMs) {
  const now = Date.now();
  const hit = mem.get(path);
  if (hit && now - hit.ts < ttlMs) {
    const doc = parse(hit.bytes);
    if (doc) return doc;
  }
  if ((cooldownUntil.get(path) ?? 0) > now) {
    return staleParsed(store, path);
  }
  try {
    const bytes = await fetchUpstream(origin, path);
    const doc = parse(bytes);
    if (doc) {
      mem.set(path, { ts: Date.now(), bytes });
      store.stalePut(`stale:${path}`, bytes);
      return doc;
    }
  } catch (err) {
    console.warn('upstream failed, trying stale:', path, err?.message ?? err);
  }
  cooldownUntil.set(path, now + COOLDOWN_MS);
  return staleParsed(store, path);
}

export async function fetchTrainsFor(origin, store, lines, ttlMs) {
  const out = [];
  for (const line of lines) {
    const doc = await getDoc(origin, store, `${line}.json`, ttlMs);
    if (doc) out.push([line, doc]);
  }
  return out;
}

export { TRAFFIC_TTL_MS };
