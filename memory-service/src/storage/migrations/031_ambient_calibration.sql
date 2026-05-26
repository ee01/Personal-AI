CREATE TABLE IF NOT EXISTS ambient_calibration_traces (
  id TEXT PRIMARY KEY,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  source_request_id TEXT,
  action TEXT NOT NULL,
  strength TEXT NOT NULL,
  polarity TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  redacted_diff_json TEXT,
  privacy_class TEXT NOT NULL DEFAULT 'normal',
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ambient_calibration_traces_surface_created
  ON ambient_calibration_traces(surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ambient_calibration_traces_scene_created
  ON ambient_calibration_traces(scene_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ambient_calibration_traces_polarity_created
  ON ambient_calibration_traces(polarity, created_at DESC);
