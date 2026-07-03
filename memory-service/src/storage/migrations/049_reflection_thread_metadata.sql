-- 049_reflection_thread_metadata.sql
-- Presentation/distillation metadata for reflection threads.

ALTER TABLE reflection_threads ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
