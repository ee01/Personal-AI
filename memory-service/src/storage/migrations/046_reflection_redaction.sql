-- 046_reflection_redaction.sql (P2-10: cascade deletion)
-- When a user explicitly deletes a source, derived reflections/dreams that cited
-- it must not keep re-surfacing the deleted information (Agentic Unlearning
-- re-pollution). These flags let the cascade redact or retract derived artifacts
-- without rewriting the markdown history.
-- evidence_redacted = 1 -> some cited evidence was deleted (note added)
-- retracted        = 1 -> all cited evidence deleted -> excluded from reindex/recall
ALTER TABLE reflection_artifacts ADD COLUMN evidence_redacted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reflection_artifacts ADD COLUMN retracted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reflection_retracted ON reflection_artifacts(retracted) WHERE retracted = 1;
