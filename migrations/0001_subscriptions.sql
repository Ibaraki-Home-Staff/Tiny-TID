-- Tiny-TID push subscriptions.
CREATE TABLE IF NOT EXISTS subscriptions (
  id                TEXT PRIMARY KEY,          -- sha256(endpoint) hex[:32]
  endpoint          TEXT NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  station_code      TEXT NOT NULL,
  prefs_json        TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  last_notified_key TEXT,
  last_notified_at  INTEGER                    -- epoch millis
);
