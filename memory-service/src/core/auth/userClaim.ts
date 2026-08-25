/**
 * TOFU claim gate for personal API keys.
 *
 * Bootstrap may only mint the first key for a brand-new namespace. Once any
 * historical pak exists (including revoked) or real user content is present,
 * further bootstrap issuance is blocked — the client must Google-verify or
 * wait for admin approval.
 *
 * Do NOT judge "exists" by filesystem directory: auth middleware already calls
 * getContext() which lazily creates the user dir + seed rows.
 */

import type BetterSqlite3 from 'better-sqlite3';

const CONTENT_COUNT_TABLES = [
  'messages_raw',
  'source_memory_capsules',
  'calendar_events',
  'today_meeting_preps',
  'user_profile_items',
  'watched_projects',
  'reflection_threads',
  'keystone_briefs',
  'outreach_templates',
  'personal_skills',
  'agent_workers',
  'memory_import_batches',
] as const;

function tableExists(db: BetterSqlite3.Database, name: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

function countRows(db: BetterSqlite3.Database, table: string): number {
  if (!tableExists(db, table)) return 0;
  try {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as {
      c: number;
    };
    return Number(row?.c || 0);
  } catch {
    return 0;
  }
}

/** All historical keys including revoked — used for claim detection. */
export function countAllUserApiKeys(db: BetterSqlite3.Database): number {
  return countRows(db, 'user_api_keys');
}

/**
 * True when the namespace has real user-generated / user-derived content.
 * Excludes migration bookkeeping and system seed profiles.
 */
export function hasUserContent(db: BetterSqlite3.Database): boolean {
  for (const table of CONTENT_COUNT_TABLES) {
    if (countRows(db, table) > 0) return true;
  }

  if (tableExists(db, 'concerned_items_state')) {
    try {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS c FROM concerned_items_state
           WHERE items_json IS NOT NULL
             AND TRIM(items_json) != ''
             AND TRIM(items_json) != '[]'`,
        )
        .get() as { c: number };
      if (Number(row?.c || 0) > 0) return true;
    } catch {
      // table shape may differ; ignore
    }
  }

  if (tableExists(db, 'agent_profile_versions')) {
    try {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS c FROM agent_profile_versions
           WHERE COALESCE(author, '') != 'system'`,
        )
        .get() as { c: number };
      if (Number(row?.c || 0) > 0) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function isNamespaceClaimable(db: BetterSqlite3.Database): boolean {
  return countAllUserApiKeys(db) === 0 && !hasUserContent(db);
}

export interface ClaimMeta {
  issuedFromIp?: string | null;
  issuedFromUa?: string | null;
  now?: number;
}

/**
 * Persist claim audit metadata. Uses CREATE TABLE IF NOT EXISTS so older DBs
 * that have not yet run migration 062 still work after a soft upgrade.
 */
export function ensureClaimAuditTable(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS user_namespace_claims (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    claimed_at INTEGER NOT NULL,
    issued_from_ip TEXT,
    issued_from_ua TEXT
  )`);
}

export function recordClaim(
  db: BetterSqlite3.Database,
  meta: ClaimMeta = {},
): void {
  ensureClaimAuditTable(db);
  const now = meta.now ?? Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO user_namespace_claims (id, claimed_at, issued_from_ip, issued_from_ua)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       claimed_at = excluded.claimed_at,
       issued_from_ip = excluded.issued_from_ip,
       issued_from_ua = excluded.issued_from_ua`,
  ).run(
    now,
    meta.issuedFromIp?.slice(0, 128) || null,
    meta.issuedFromUa?.slice(0, 256) || null,
  );
}
