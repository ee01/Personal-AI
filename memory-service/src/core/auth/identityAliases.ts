/**
 * Verified Google email ↔ user namespace aliases.
 */

import type BetterSqlite3 from 'better-sqlite3';

export function ensureIdentityAliasTable(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS user_identity_aliases (
    email TEXT PRIMARY KEY,
    verified_at INTEGER NOT NULL,
    added_by TEXT,
    source TEXT
  )`);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailLocalPart(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf('@');
  return at > 0 ? normalized.slice(0, at) : normalized;
}

export function hasVerifiedAlias(
  db: BetterSqlite3.Database,
  email: string,
): boolean {
  ensureIdentityAliasTable(db);
  const row = db
    .prepare(`SELECT 1 AS ok FROM user_identity_aliases WHERE email = ?`)
    .get(normalizeEmail(email)) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

export function upsertIdentityAlias(
  db: BetterSqlite3.Database,
  email: string,
  options: { addedBy?: string; source?: string; now?: number } = {},
): void {
  ensureIdentityAliasTable(db);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO user_identity_aliases (email, verified_at, added_by, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       verified_at = excluded.verified_at,
       added_by = excluded.added_by,
       source = excluded.source`,
  ).run(
    normalizeEmail(email),
    now,
    options.addedBy || null,
    options.source || 'admin_approval',
  );
}

/** True when Google email localpart matches userId or an alias exists. */
export function googleEmailMatchesUser(
  db: BetterSqlite3.Database,
  userId: string,
  email: string,
): boolean {
  const local = emailLocalPart(email);
  if (local && local === userId.trim().toLowerCase()) return true;
  return hasVerifiedAlias(db, email);
}
