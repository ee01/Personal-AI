-- P0a-4 (memory-foundation plan §9.2 / §11.2 item 4): stop rehearsal
-- activation write amplification (1.95M rows / 850 MB observed on the main
-- user database).
--
-- New writes aggregate per (rehearsal, scene, surface, hour bucket):
--   window_start = floor(event_time / 3600) * 3600
--   UNIQUE(rehearsal_id, scene_key_hash, surface, window_start)
--   repeat_count += 1; first_seen_at = min(...); last_seen_at = max(...)
--
-- The full UNIQUE constraint requires rebuilding the 850 MB table; that
-- rebuild is intentionally deferred to the P0b historical-noise cleanup,
-- where the table is rewritten anyway ("历史清理必须在新写路径上线并验证后
-- 执行"). Until then the single-writer service upserts conditionally on the
-- bucket index below, which is behaviorally equivalent for a single process.

ALTER TABLE rehearsal_activations ADD COLUMN window_start INTEGER;
ALTER TABLE rehearsal_activations ADD COLUMN repeat_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rehearsal_activations ADD COLUMN first_seen_at INTEGER;
ALTER TABLE rehearsal_activations ADD COLUMN last_seen_at INTEGER;
ALTER TABLE rehearsal_activations ADD COLUMN scene_key_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_rehearsal_activations_bucket
  ON rehearsal_activations(rehearsal_id, scene_key_hash, surface, window_start);
