// SQLite store. Mirrors migrations/0001 (subscriptions) and 0002
// (network_snapshot) 1:1; `stale_cache` replaces Workers KV stale fallback.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function openStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'tiny-tid.sqlite3'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                TEXT PRIMARY KEY,
      endpoint          TEXT NOT NULL UNIQUE,
      p256dh            TEXT NOT NULL,
      auth              TEXT NOT NULL,
      station_code      TEXT NOT NULL,
      prefs_json        TEXT NOT NULL DEFAULT '{}',
      created_at        TEXT NOT NULL,
      last_notified_key TEXT,
      last_notified_at  INTEGER
    );
    CREATE TABLE IF NOT EXISTS network_snapshot (
      key      TEXT PRIMARY KEY,
      built_at TEXT NOT NULL,
      data     BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stale_cache (
      key        TEXT PRIMARY KEY,
      data       BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    getSnapshot() {
      return (
        db
          .prepare('SELECT built_at AS builtAt, data FROM network_snapshot WHERE key = ?')
          .get('v1') ?? null
      );
    },
    saveSnapshot(builtAt, data) {
      db.prepare(
        `INSERT INTO network_snapshot (key, built_at, data) VALUES ('v1', ?, ?)
         ON CONFLICT(key) DO UPDATE SET built_at = excluded.built_at, data = excluded.data`,
      ).run(builtAt, data);
    },
    listSubscriptions() {
      return db
        .prepare(
          `SELECT id, endpoint, p256dh, auth, station_code AS stationCode,
                  prefs_json AS prefsJson, last_notified_key AS lastNotifiedKey,
                  last_notified_at AS lastNotifiedAt
           FROM subscriptions`,
        )
        .all();
    },
    upsertSubscription({ id, endpoint, p256dh, auth, stationCode, prefsJson, createdAt }) {
      db.prepare(
        `INSERT INTO subscriptions (id, endpoint, p256dh, auth, station_code, prefs_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET station_code = excluded.station_code,
                                       prefs_json = excluded.prefs_json`,
      ).run(id, endpoint, p256dh, auth, stationCode, prefsJson, createdAt);
    },
    deleteSubscription(id) {
      db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
    },
    markNotified(id, key, at) {
      db.prepare(
        'UPDATE subscriptions SET last_notified_key = ?, last_notified_at = ? WHERE id = ?',
      ).run(key, at, id);
    },
    staleGet(key) {
      return db.prepare('SELECT data FROM stale_cache WHERE key = ?').get(key)?.data ?? null;
    },
    stalePut(key, data) {
      db.prepare(
        `INSERT INTO stale_cache (key, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      ).run(key, data, Date.now());
    },
  };
}
