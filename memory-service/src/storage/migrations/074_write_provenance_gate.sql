-- Deterministic conservative backfill. No content deletion or owner fallback.
ALTER TABLE messages_raw ADD COLUMN origin_class TEXT CHECK(origin_class IN ('owner','observed','agent','untrusted','system'));
ALTER TABLE messages_raw ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'interactive' CHECK(session_kind IN ('interactive','import','heartbeat','cron','subagent','reflection','dream'));
ALTER TABLE messages_raw ADD COLUMN promotion_eligible INTEGER NOT NULL DEFAULT 0 CHECK(promotion_eligible IN (0,1));
ALTER TABLE messages_raw ADD COLUMN derived_from_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE memory_unit_sources ADD COLUMN origin_class TEXT CHECK(origin_class IN ('owner','observed','agent','untrusted','system'));
ALTER TABLE memory_unit_sources ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'interactive' CHECK(session_kind IN ('interactive','import','heartbeat','cron','subagent','reflection','dream'));
ALTER TABLE memory_unit_sources ADD COLUMN promotion_eligible INTEGER NOT NULL DEFAULT 0 CHECK(promotion_eligible IN (0,1));
ALTER TABLE memory_unit_sources ADD COLUMN derived_from_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE messages_raw ADD COLUMN origin_family TEXT;
UPDATE messages_raw SET session_kind=(CASE WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') IN ('interactive','import','heartbeat','cron','subagent','reflection','dream') THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') WHEN source_type='system' THEN 'cron' ELSE 'interactive' END), origin_class=(CASE
 WHEN content LIKE '%<recalled %' THEN 'agent'
 WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.turn_tainted')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.network_origin')=1 THEN 'untrusted'
 WHEN (CASE WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') IN ('interactive','import','heartbeat','cron','subagent','reflection','dream') THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') WHEN source_type='system' THEN 'cron' ELSE 'interactive' END) IN ('heartbeat','cron','subagent','reflection','dream') OR source_type='system' OR lower(coalesce(sender,'')) IN ('system','scaffold') THEN 'system'
 WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.importBatchId') IS NOT NULL OR sender='memory-import' THEN 'untrusted'
 WHEN source_type IN ('web','ai_chat','doubao','chatgpt','doubao_chat','codex_cli','claude_code_cli','cursor_agent_cli','mcp_client','openclaw','external_ai','email_external') THEN 'untrusted'
 WHEN lower(coalesce(sender,'')) IN ('assistant','agent','ai') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.role')='assistant' OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.generatedByAgent')=1 THEN 'agent'
 WHEN source_type='manual' OR source_type IN ('glip','jira') AND (json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.authorIsSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.senderIsSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.fromSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.isOwner')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.ownerAuthored')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.authorRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.senderRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.fromRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.role') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.messageAuthorRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.author.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.sender.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.from.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.participant.isSelf')=1) THEN 'owner'
 WHEN source_type IN ('glip','jira','meeting','calendar') THEN 'observed'
 ELSE 'untrusted' END), origin_family=source_type || ':' || coalesce(nullif(sender,''),'unknown');
UPDATE messages_raw SET promotion_eligible=CASE WHEN origin_class IN ('owner','observed') AND session_kind IN ('interactive','import') THEN 1 ELSE 0 END;
CREATE TRIGGER messages_raw_provenance_insert AFTER INSERT ON messages_raw WHEN NEW.origin_class IS NULL BEGIN
 UPDATE messages_raw SET session_kind=(CASE WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') IN ('interactive','import','heartbeat','cron','subagent','reflection','dream') THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') WHEN source_type='system' THEN 'cron' ELSE 'interactive' END), origin_class=(CASE
 WHEN content LIKE '%<recalled %' THEN 'agent'
 WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.turn_tainted')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.network_origin')=1 THEN 'untrusted'
 WHEN (CASE WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') IN ('interactive','import','heartbeat','cron','subagent','reflection','dream') THEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.session_kind') WHEN source_type='system' THEN 'cron' ELSE 'interactive' END) IN ('heartbeat','cron','subagent','reflection','dream') OR source_type='system' OR lower(coalesce(sender,'')) IN ('system','scaffold') THEN 'system'
 WHEN json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.importBatchId') IS NOT NULL OR sender='memory-import' THEN 'untrusted'
 WHEN source_type IN ('web','ai_chat','doubao','chatgpt','doubao_chat','codex_cli','claude_code_cli','cursor_agent_cli','mcp_client','openclaw','external_ai','email_external') THEN 'untrusted'
 WHEN lower(coalesce(sender,'')) IN ('assistant','agent','ai') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.role')='assistant' OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.generatedByAgent')=1 THEN 'agent'
 WHEN source_type='manual' OR source_type IN ('glip','jira') AND (json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.authorIsSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.senderIsSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.fromSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.isOwner')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.ownerAuthored')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.authorRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.senderRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.fromRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.role') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.messageAuthorRole') IN ('owner','self','user') OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.author.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.sender.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.from.isSelf')=1 OR json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.participant.isSelf')=1) THEN 'owner'
 WHEN source_type IN ('glip','jira','meeting','calendar') THEN 'observed'
 ELSE 'untrusted' END), origin_family=source_type || ':' || coalesce(nullif(sender,''),'unknown') WHERE id=NEW.id;
 UPDATE messages_raw SET promotion_eligible=CASE WHEN origin_class IN ('owner','observed') AND session_kind IN ('interactive','import') THEN 1 ELSE 0 END WHERE id=NEW.id;
END;
UPDATE memory_unit_sources SET
 origin_class=(SELECT origin_class FROM messages_raw WHERE id=episode_id),
 session_kind=(SELECT session_kind FROM messages_raw WHERE id=episode_id),
 promotion_eligible=(SELECT promotion_eligible FROM messages_raw WHERE id=episode_id),
 derived_from_json=(SELECT derived_from_json FROM messages_raw WHERE id=episode_id);
CREATE TRIGGER unit_source_provenance_insert AFTER INSERT ON memory_unit_sources BEGIN
 UPDATE memory_unit_sources SET
 origin_class=(SELECT origin_class FROM messages_raw WHERE id=NEW.episode_id),
 session_kind=(SELECT session_kind FROM messages_raw WHERE id=NEW.episode_id),
 promotion_eligible=(SELECT promotion_eligible FROM messages_raw WHERE id=NEW.episode_id),
 derived_from_json=(SELECT derived_from_json FROM messages_raw WHERE id=NEW.episode_id)
 WHERE unit_id=NEW.unit_id AND episode_id=NEW.episode_id AND evidence_key=NEW.evidence_key;
END;
CREATE INDEX idx_messages_promotion ON messages_raw(promotion_eligible,timestamp);
CREATE INDEX idx_unit_sources_promotion ON memory_unit_sources(promotion_eligible,unit_id);
-- Legacy chunks have no unit FK. Preserve existing exposure rows and allow
-- their stable reference alongside optional v3 unit FK.
ALTER TABLE memory_exposures RENAME TO memory_exposures_old;
CREATE TABLE memory_exposures (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 request_id TEXT NOT NULL,
 unit_id TEXT REFERENCES memory_units(id),
 memory_id TEXT,
 surface TEXT NOT NULL,
 turn_id TEXT,
 rank INTEGER NOT NULL,
 shown INTEGER NOT NULL DEFAULT 0,
 quieted INTEGER NOT NULL DEFAULT 0,
 no_result INTEGER NOT NULL DEFAULT 0,
 policy_version TEXT,
 created_at INTEGER NOT NULL
);
INSERT INTO memory_exposures(id,request_id,unit_id,surface,rank,shown,quieted,no_result,policy_version,created_at)
 SELECT id,request_id,unit_id,surface,rank,shown,quieted,no_result,policy_version,created_at FROM memory_exposures_old;
DROP TABLE memory_exposures_old;
CREATE INDEX idx_memory_exposures_request ON memory_exposures(request_id);
CREATE INDEX idx_memory_exposures_unit ON memory_exposures(unit_id,created_at DESC);
CREATE INDEX idx_memory_exposures_turn ON memory_exposures(turn_id,created_at DESC);
ALTER TABLE reflection_artifacts ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'reflection';
ALTER TABLE notification_records ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'heartbeat';
CREATE TABLE memory_turn_taint (
 session_id TEXT PRIMARY KEY,
 turn_id TEXT,
 tainted INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);

CREATE VIEW promotion_eligible_units AS
 SELECT u.* FROM memory_units u WHERE EXISTS
 (SELECT 1 FROM memory_unit_sources s WHERE s.unit_id=u.id AND s.promotion_eligible=1);
ALTER TABLE dream_runs ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'dream';
