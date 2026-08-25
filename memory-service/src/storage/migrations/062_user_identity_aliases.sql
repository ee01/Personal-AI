-- 062_user_identity_aliases.sql
-- Maps a verified Google email to this user namespace so mismatched
-- localparts only need admin approval once.
CREATE TABLE IF NOT EXISTS user_identity_aliases (
  email TEXT PRIMARY KEY,
  verified_at INTEGER NOT NULL,
  added_by TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_identity_aliases_verified
  ON user_identity_aliases(verified_at);

-- Audit row for the first bootstrap claim of this namespace.
CREATE TABLE IF NOT EXISTS user_namespace_claims (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  claimed_at INTEGER NOT NULL,
  issued_from_ip TEXT,
  issued_from_ua TEXT
);
