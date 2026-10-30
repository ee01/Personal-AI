-- RingCentral Team Messaging webhook POC: subscription registry, delivery dedup, backfill watermarks

CREATE TABLE IF NOT EXISTS rc_tm_webhook_subscriptions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL UNIQUE,
  delivery_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  event_filters_json TEXT NOT NULL,
  expires_at INTEGER,
  last_renewed_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rc_tm_sub_status ON rc_tm_webhook_subscriptions(status);

CREATE TABLE IF NOT EXISTS rc_tm_webhook_deliveries (
  delivery_key TEXT PRIMARY KEY,
  event_type TEXT,
  post_id TEXT,
  payload_hash TEXT,
  processed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rc_tm_delivery_post ON rc_tm_webhook_deliveries(post_id);

CREATE TABLE IF NOT EXISTS rc_tm_backfill_watermarks (
  chat_id TEXT PRIMARY KEY,
  last_post_id TEXT,
  last_creation_time TEXT,
  last_run_at INTEGER NOT NULL,
  posts_ingested INTEGER NOT NULL DEFAULT 0
);
