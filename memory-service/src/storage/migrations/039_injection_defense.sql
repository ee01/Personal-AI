-- Injection defense (P0-2): trust class + screened injection flags.
-- trust_class is 'trusted' | 'internal' | 'untrusted', derived from source type
-- at ingest. Untrusted content (web pages, external AI, OpenClaw) is wrapped in
-- a neutral data frame before entering any model prompt.
-- injection_flags_json is an array of matched injection-pattern labels, or NULL.
-- Flagging never deletes or rewrites content -- it only annotates provenance.

ALTER TABLE messages_raw ADD COLUMN trust_class TEXT;
ALTER TABLE messages_raw ADD COLUMN injection_flags_json TEXT;

ALTER TABLE chunks ADD COLUMN trust_class TEXT;
ALTER TABLE chunks ADD COLUMN injection_flags_json TEXT;

CREATE INDEX IF NOT EXISTS idx_msg_trust_class ON messages_raw(trust_class);
