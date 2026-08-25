-- Network graph snapshot (built daily by cron).
CREATE TABLE IF NOT EXISTS network_snapshot (
  key      TEXT PRIMARY KEY,
  built_at TEXT NOT NULL,
  data     BLOB NOT NULL
);
