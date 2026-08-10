-- 059_agent_executor_runtime.sql
-- Agent executor control-plane: unique idempotency + recoverable input_required status

-- Clear older duplicate idempotency keys so UNIQUE index can apply (keep newest).
UPDATE proposed_actions
SET idempotency_key = NULL
WHERE idempotency_key IS NOT NULL
  AND idempotency_key != ''
  AND EXISTS (
    SELECT 1
    FROM proposed_actions newer
    WHERE newer.idempotency_key = proposed_actions.idempotency_key
      AND (
        newer.created_at > proposed_actions.created_at
        OR (
          newer.created_at = proposed_actions.created_at
          AND newer.id > proposed_actions.id
        )
      )
  );

DROP INDEX IF EXISTS idx_proposed_actions_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposed_actions_idempotency_unique
  ON proposed_actions(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';

-- input_required is a recoverable queue status (not failed). Existing TEXT column.
-- Allowed values: queued | running | succeeded | failed | cancelled | dead_letter | input_required
