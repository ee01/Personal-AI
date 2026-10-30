import Database from "better-sqlite3";

export interface Watermarks {
  ingest: number;
  raw_index: number;
  vec_index: number;
  consolidated: number;
}

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence_events (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      source_version TEXT NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      body TEXT NOT NULL,
      occurred_at_ms INTEGER,
      observed_at_ms INTEGER NOT NULL,
      ingest_seq INTEGER NOT NULL,
      owner_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      speaker TEXT,
      acl_scope TEXT NOT NULL,
      tombstone INTEGER NOT NULL DEFAULT 0,
      unconsolidated INTEGER NOT NULL DEFAULT 1,
      UNIQUE(owner_id, source, event_id, source_version)
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_scope_obs
      ON evidence_events(owner_id, scope, observed_at_ms, ingest_seq)
      WHERE tombstone = 0;

    CREATE VIRTUAL TABLE IF NOT EXISTS evidence_fts USING fts5(
      event_id UNINDEXED,
      source_version UNINDEXED,
      scope UNINDEXED,
      body,
      tokenize='unicode61'
    );

    CREATE TABLE IF NOT EXISTS event_vectors (
      event_id TEXT NOT NULL,
      source_version TEXT NOT NULL,
      scope TEXT NOT NULL,
      vec BLOB NOT NULL,
      PRIMARY KEY (event_id, source_version)
    );

    CREATE TABLE IF NOT EXISTS fact_revisions (
      fact_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      subject TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_text TEXT NOT NULL,
      status TEXT NOT NULL,
      assertion_class TEXT NOT NULL,
      observed_at_ms INTEGER NOT NULL,
      known_from_ms INTEGER NOT NULL,
      known_to_ms INTEGER NOT NULL,
      scope TEXT NOT NULL,
      evidence_event_id TEXT NOT NULL,
      evidence_source_version TEXT NOT NULL,
      PRIMARY KEY (fact_id, revision)
    );

    CREATE INDEX IF NOT EXISTS idx_facts_scope_known
      ON fact_revisions(scope, known_from_ms, known_to_ms)
      WHERE status IN ('active','candidate');

    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      text TEXT NOT NULL,
      observed_at_ms INTEGER NOT NULL,
      known_from_ms INTEGER NOT NULL,
      known_to_ms INTEGER NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence_refs_json TEXT NOT NULL,
      PRIMARY KEY (artifact_id, revision)
    );

    CREATE TABLE IF NOT EXISTS entity_edges (
      edge_id TEXT PRIMARY KEY,
      from_key TEXT NOT NULL,
      to_key TEXT NOT NULL,
      type TEXT NOT NULL,
      scope TEXT NOT NULL,
      valid_from_ms INTEGER NOT NULL,
      known_from_ms INTEGER NOT NULL,
      evidence_event_id TEXT
    );

    CREATE TABLE IF NOT EXISTS consolidation_days (
      virtual_day TEXT PRIMARY KEY,
      completed_at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decision_cooldown (
      cooldown_key TEXT PRIMARY KEY,
      last_sent_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingest_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase TEXT NOT NULL,
      event_id TEXT,
      latency_ms REAL NOT NULL,
      at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consolidate_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase TEXT NOT NULL,
      virtual_day TEXT,
      latency_ms REAL NOT NULL,
      at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recall_traces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_hash TEXT NOT NULL,
      phase TEXT NOT NULL,
      latency_ms REAL NOT NULL,
      at_ms INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS async_jobs (
      job_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      completed_at_ms INTEGER,
      attempt INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS decision_outbox (
      decision_id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      scene TEXT NOT NULL,
      target TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence_refs_json TEXT NOT NULL,
      reason_codes_json TEXT NOT NULL,
      value_score REAL NOT NULL,
      created_at_virtual TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      scope TEXT NOT NULL,
      acl_epoch INTEGER NOT NULL
    );
  `);

  const defaults: Record<string, string> = {
    acl_epoch: "0",
    revoked_scopes: "[]",
    ingest_watermark: "0",
    raw_index_watermark: "0",
    vec_index_watermark: "0",
    consolidated_watermark: "0",
    ingest_seq: "0",
    vec_index_build_ms: "0",
  };
  const ins = db.prepare(
    "INSERT OR IGNORE INTO meta (key, value) VALUES (@key, @value)",
  );
  for (const [key, value] of Object.entries(defaults)) {
    ins.run({ key, value });
  }
}

export function getMeta(db: Database.Database, key: string): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function nextIngestSeq(db: Database.Database): number {
  const cur = Number(getMeta(db, "ingest_seq")) || 0;
  const next = cur + 1;
  setMeta(db, "ingest_seq", String(next));
  return next;
}

export function readWatermarks(db: Database.Database): Watermarks {
  return {
    ingest: Number(getMeta(db, "ingest_watermark")) || 0,
    raw_index: Number(getMeta(db, "raw_index_watermark")) || 0,
    vec_index: Number(getMeta(db, "vec_index_watermark")) || 0,
    consolidated: Number(getMeta(db, "consolidated_watermark")) || 0,
  };
}

export function bumpWatermark(
  db: Database.Database,
  key: keyof Watermarks,
  observedMs: number,
): void {
  const map: Record<keyof Watermarks, string> = {
    ingest: "ingest_watermark",
    raw_index: "raw_index_watermark",
    vec_index: "vec_index_watermark",
    consolidated: "consolidated_watermark",
  };
  const cur = Number(getMeta(db, map[key])) || 0;
  if (observedMs > cur) setMeta(db, map[key], String(observedMs));
}

export function parseRevokedScopes(db: Database.Database): Set<string> {
  try {
    return new Set(JSON.parse(getMeta(db, "revoked_scopes") || "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function saveRevokedScopes(db: Database.Database, scopes: Set<string>): void {
  setMeta(db, "revoked_scopes", JSON.stringify([...scopes]));
}

export function bumpAclEpoch(db: Database.Database): number {
  const next = Number(getMeta(db, "acl_epoch")) || 0;
  setMeta(db, "acl_epoch", String(next + 1));
  return next + 1;
}
