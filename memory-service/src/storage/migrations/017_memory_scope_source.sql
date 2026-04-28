ALTER TABLE messages_raw ADD COLUMN scope TEXT NOT NULL DEFAULT 'work';
ALTER TABLE messages_raw ADD COLUMN source TEXT;

UPDATE messages_raw
SET scope = 'work'
WHERE scope IS NULL OR TRIM(scope) = '';

CREATE INDEX IF NOT EXISTS idx_msg_scope ON messages_raw(scope);
CREATE INDEX IF NOT EXISTS idx_msg_scope_source ON messages_raw(scope, source);

ALTER TABLE chunks ADD COLUMN scope TEXT NOT NULL DEFAULT 'work';
ALTER TABLE chunks ADD COLUMN source TEXT;

UPDATE chunks
SET scope = COALESCE(
  (
    SELECT CASE COALESCE(messages_raw.scope, 'work')
      WHEN 'personal' THEN 'personal'
      ELSE 'work'
    END
    FROM messages_raw
    WHERE messages_raw.id = chunks.related_entity_id
  ),
  'work'
)
WHERE scope IS NULL OR TRIM(scope) = '';

UPDATE chunks
SET source = (
  SELECT messages_raw.source
  FROM messages_raw
  WHERE messages_raw.id = chunks.related_entity_id
)
WHERE source IS NULL AND related_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_scope ON chunks(scope);
CREATE INDEX IF NOT EXISTS idx_chunks_scope_source ON chunks(scope, source);
