CREATE TABLE IF NOT EXISTS channel_delivery_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_ref TEXT NOT NULL,
  channel TEXT NOT NULL,
  lane TEXT NOT NULL,
  status TEXT NOT NULL,
  external_ref TEXT,
  last_error TEXT,
  first_delivered_at INTEGER,
  last_delivered_at INTEGER,
  seen_at INTEGER,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(source_ref, channel, lane)
);

CREATE INDEX IF NOT EXISTS idx_channel_delivery_lookup
  ON channel_delivery_records(channel, lane, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_delivery_source
  ON channel_delivery_records(source_ref, channel, lane);
