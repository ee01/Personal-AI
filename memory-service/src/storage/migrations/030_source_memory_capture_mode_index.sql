CREATE INDEX IF NOT EXISTS idx_source_memory_capsules_capture_mode_saved
  ON source_memory_capsules(capture_mode, saved_at DESC);
