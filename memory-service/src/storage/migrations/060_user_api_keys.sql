-- 060_user_api_keys.sql
-- Tier-2 credentials: long-lived personal keys bound to this user's space.
--
-- Lives in the per-user database, so a key row can only ever authorize the
-- user whose database it sits in. The token itself carries the userId so the
-- auth middleware knows which database to open before verifying the hash.
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT 'Context Pack',
  key_prefix TEXT NOT NULL,        -- displayable head, e.g. pak.ZXNvbmU.AbCd
  key_hash TEXT NOT NULL,          -- sha256(full token), hex
  scopes TEXT NOT NULL DEFAULT 'memory.read',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER,
  issued_from_ip TEXT,
  issued_from_ua TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_api_keys_hash ON user_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(revoked_at, created_at);
