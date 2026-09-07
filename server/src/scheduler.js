// Background jobs: lazy snapshot build, minutely push evaluation,
// daily 03:00 JST network rebuild. Mirrors tid-worker scheduled handlers.
import { AREAS, MASTER_TTL_MS, SUPPRESS_MS, TRAFFIC_TTL_MS, TRAINS_TTL_MS } from './config.js';
import { fetchTrainsFor, getDoc } from './upstream.js';

export function isoNow() {
  return new Date().toISOString();
}

function snapshotText(store) {
  const row = store.getSnapshot();
  return row ? Buffer.from(row.data).toString('utf8') : null;
}

export function loadSnapshot(store, core) {
  const text = snapshotText(store);
  if (!text) return null;
  try {
    const snap = JSON.parse(text);
    return snap?.version === core.snapshotVersion() ? snap : null;
  } catch {
    return null;
  }
}

export async function rebuildNetwork(ctx) {
  const { config, store, core } = ctx;
  const stDocs = [];
  const masters = [];
  let fetched = 0;
  for (const area of AREAS) {
    const m = await getDoc(config.origin, store, `area_${area}_master.json`, MASTER_TTL_MS);
    if (m) masters.push([area, m]);
  }
  for (const [, m] of masters) {
    for (const lineId of Object.keys(m?.lines ?? {})) {
      fetched += 1;
      const doc = await getDoc(config.origin, store, `${lineId}_st.json`, MASTER_TTL_MS);
      if (doc) stDocs.push([lineId, doc]);
    }
  }
  const builtAt = isoNow();
  const snapJson = core.buildFullSnapshot(builtAt, JSON.stringify(stDocs), JSON.stringify(masters));
  store.saveSnapshot(builtAt, Buffer.from(snapJson, 'utf8'));
  const snap = JSON.parse(snapJson);
  const nodes = Object.values(snap.lines ?? {}).reduce((n, m) => n + Object.keys(m).length, 0);
  console.log(`network rebuilt: areas=${masters.length} lines_fetched=${fetched} lines_built=${stDocs.length} nodes=${nodes}`);
  return snap;
}

export async function ensureSnapshot(ctx) {
  const snap = loadSnapshot(ctx.store, ctx.core);
  if (snap) return snap;
  return rebuildNetwork(ctx);
}

function jstParts(now = Date.now()) {
  const jst = new Date(now + 9 * 60 * 60 * 1000);
  return { day: jst.getUTCDate(), month: jst.getUTCMonth(), hour: jst.getUTCHours() };
}

export async function runPushEval(ctx) {
  const { config, store, core, push } = ctx;
  const snap = await ensureSnapshot(ctx);
  const subs = store.listSubscriptions();
  if (subs.length === 0) return 0;
  const payloads = await fetchTrainsFor(config.origin, store, config.scopeLines, TRAINS_TTL_MS);
  const byStation = new Map();
  for (const s of subs) {
    if (!byStation.has(s.stationCode)) byStation.set(s.stationCode, []);
    byStation.get(s.stationCode).push(s);
  }
  const now = Date.now();
  let sent = 0;
  for (const [stationQuery, group] of byStation) {
    for (const sub of group) {
      let parsed;
      try {
        parsed = JSON.parse(
          core.cronEvaluateJson(
            JSON.stringify(snap),
            JSON.stringify({
              scope: config.scopeLines,
              primaryLine: config.fixedLine,
              stationQuery,
              payloads,
              area: config.fixedArea,
              scopeCsv: config.scopeLines.join(','),
              prefsJson: sub.prefsJson ?? '{}',
            }),
          ),
        );
      } catch (err) {
        console.warn('cron evaluate failed:', stationQuery, err?.message ?? err);
        continue;
      }
      if (!parsed.stationCode) continue;
      for (const ev of parsed.events ?? []) {
        const fresh = !(
          sub.lastNotifiedKey === ev.key &&
          sub.lastNotifiedAt != null &&
          now - sub.lastNotifiedAt < SUPPRESS_MS
        );
        if (!fresh) continue;
        try {
          const r = await sendPush(push, sub, ev.message, ev.tag);
          if (r === 'sent') {
            sent += 1;
            store.markNotified(sub.id, ev.key, now);
          } else if (r === 'gone') {
            store.deleteSubscription(sub.id);
          }
        } catch (err) {
          console.warn('push send failed:', err?.message ?? err);
        }
      }
    }
  }
  if (sent > 0) console.log(`push sent: ${sent}`);
  return sent;
}

export function startScheduler(ctx) {
  let lastRebuildKey = '';
  const tick = async () => {
    try {
      await runPushEval(ctx);
    } catch (err) {
      console.error('push cron failed:', err?.message ?? err);
    }
    try {
      const { day, month, hour } = jstParts();
      const key = `${month + 1}/${day}`;
      if (hour >= 3 && lastRebuildKey !== key) {
        lastRebuildKey = key;
        await rebuildNetwork(ctx);
      }
    } catch (err) {
      console.error('network rebuild failed:', err?.message ?? err);
    }
  };
  // Stagger first run so boot stays fast; then minutely like CF cron.
  setTimeout(tick, 5_000);
  setInterval(tick, 60_000);
}
