import Database from "better-sqlite3";

export function openRegistryDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence_events (
      event_id TEXT NOT NULL,
      source_version TEXT NOT NULL,
      scope TEXT NOT NULL,
      body TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      observed_at_ms INTEGER NOT NULL,
      tombstone INTEGER NOT NULL DEFAULT 0,
      unconsolidated INTEGER NOT NULL DEFAULT 1,
      memfs_path TEXT NOT NULL DEFAULT '',
      letta_agent_id TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (event_id, source_version)
    );
    CREATE TABLE IF NOT EXISTS consolidation_days (
      virtual_day TEXT PRIMARY KEY,
      completed_at_ms INTEGER NOT NULL
    );
  `);
  if (!db.prepare("SELECT 1 FROM meta WHERE key = 'acl_epoch'").get()) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('acl_epoch', '0')").run();
  }
  if (!db.prepare("SELECT 1 FROM meta WHERE key = 'revoked_scopes'").get()) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('revoked_scopes', '[]')").run();
  }
  return db;
}

export function getMeta(db: Database.Database, key: string): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? "";
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(key, value);
}

export function bumpAclEpoch(db: Database.Database): void {
  const n = Number(getMeta(db, "acl_epoch")) || 0;
  db.prepare("UPDATE meta SET value = ? WHERE key = 'acl_epoch'").run(String(n + 1));
}

export function parseRevokedScopes(db: Database.Database): Set<string> {
  try {
    const raw = JSON.parse(getMeta(db, "revoked_scopes")) as unknown;
    if (Array.isArray(raw)) return new Set(raw.filter((x) => typeof x === "string"));
  } catch {
    /* ignore */
  }
  return new Set();
}

export function saveRevokedScopes(db: Database.Database, scopes: Set<string>): void {
  db.prepare("UPDATE meta SET value = ? WHERE key = 'revoked_scopes'").run(
    JSON.stringify([...scopes]),
  );
}
