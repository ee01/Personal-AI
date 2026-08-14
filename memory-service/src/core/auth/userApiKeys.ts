/**
 * Tier-2 personal API keys.
 *
 * Trust model (two tiers):
 *  - Tier 1 "service key" (`API_KEY`): first-party clients (extension, desktop
 *    app). May act for any user via `X-User-Id`. Unchanged from before.
 *  - Tier 2 "user key" (this module): bound to exactly one user, safe to paste
 *    into external REST / MCP / A2A clients. Cannot address another user.
 *
 * Token layout: `pak.<base64url(userId)>.<secret>`
 * The userId segment is not a secret — it only tells the server which per-user
 * database to open. Authorization still requires the sha256 of the whole token
 * to match a non-revoked row inside that database.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

import { normalizeUserId } from '../../utils/userIdentity.js';

export const USER_API_KEY_PREFIX = 'pak';

export type UserApiKeyScope = 'memory.read' | 'memory.write' | 'evidence.raw.read';

export const DEFAULT_USER_API_KEY_SCOPES: UserApiKeyScope[] = ['memory.read'];

export interface UserApiKeyRecord {
  id: string;
  label: string;
  keyPrefix: string;
  scopes: UserApiKeyScope[];
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  issuedFromIp: string | null;
  issuedFromUa: string | null;
}

export interface IssuedUserApiKey {
  /** Full plaintext token. Returned exactly once, never persisted. */
  token: string;
  record: UserApiKeyRecord;
}

interface UserApiKeyRow {
  id: string;
  label: string;
  key_prefix: string;
  key_hash: string;
  scopes: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
  issued_from_ip: string | null;
  issued_from_ua: string | null;
}

function encodeUserId(userId: string): string {
  return Buffer.from(userId, 'utf8').toString('base64url');
}

function decodeUserId(encoded: string): string | null {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    return normalizeUserId(raw);
  } catch {
    return null;
  }
}

export function hashUserApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Extract the target userId from a token without touching any database.
 * Returns null when the token is not a user key at all (e.g. a service key).
 */
export function parseUserApiKey(
  token: string | undefined | null,
): { userId: string; token: string } | null {
  if (!token) return null;
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3 || parts[0] !== USER_API_KEY_PREFIX) return null;
  if (!parts[1] || !parts[2]) return null;
  const userId = decodeUserId(parts[1]);
  if (!userId) return null;
  return { userId, token: trimmed };
}

export function looksLikeUserApiKey(token: string | undefined | null): boolean {
  return parseUserApiKey(token) !== null;
}

function toRecord(row: UserApiKeyRow): UserApiKeyRecord {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.key_prefix,
    scopes: row.scopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as UserApiKeyScope[],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    issuedFromIp: row.issued_from_ip ?? null,
    issuedFromUa: row.issued_from_ua ?? null,
  };
}

function ensureTable(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT 'Context Pack',
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT 'memory.read',
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    revoked_at INTEGER,
    issued_from_ip TEXT,
    issued_from_ua TEXT
  )`);
  // Soft-upgrade columns for DBs created before issuance metadata existed.
  const cols = (
    db.prepare(`PRAGMA table_info(user_api_keys)`).all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!cols.includes('issued_from_ip')) {
    db.exec(`ALTER TABLE user_api_keys ADD COLUMN issued_from_ip TEXT`);
  }
  if (!cols.includes('issued_from_ua')) {
    db.exec(`ALTER TABLE user_api_keys ADD COLUMN issued_from_ua TEXT`);
  }
}

export function issueUserApiKey(
  db: BetterSqlite3.Database,
  userId: string,
  options: {
    label?: string;
    scopes?: UserApiKeyScope[];
    now?: number;
    issuedFromIp?: string | null;
    issuedFromUa?: string | null;
  } = {},
): IssuedUserApiKey {
  ensureTable(db);
  const secret = randomBytes(32).toString('base64url');
  const token = `${USER_API_KEY_PREFIX}.${encodeUserId(userId)}.${secret}`;
  const keyPrefix = `${USER_API_KEY_PREFIX}.${encodeUserId(userId)}.${secret.slice(0, 6)}`;
  const scopes = options.scopes?.length
    ? options.scopes
    : DEFAULT_USER_API_KEY_SCOPES;
  const createdAt = options.now ?? Math.floor(Date.now() / 1000);
  const id = randomUUID();
  const issuedFromIp = options.issuedFromIp?.slice(0, 128) || null;
  const issuedFromUa = options.issuedFromUa?.slice(0, 256) || null;

  db.prepare(
    `INSERT INTO user_api_keys
      (id, label, key_prefix, key_hash, scopes, created_at, issued_from_ip, issued_from_ua)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    options.label?.trim() || 'Context Pack',
    keyPrefix,
    hashUserApiKey(token),
    scopes.join(','),
    createdAt,
    issuedFromIp,
    issuedFromUa,
  );

  return {
    token,
    record: {
      id,
      label: options.label?.trim() || 'Context Pack',
      keyPrefix,
      scopes,
      createdAt,
      lastUsedAt: null,
      revokedAt: null,
      issuedFromIp,
      issuedFromUa,
    },
  };
}

/** Active keys created within the last `windowSeconds` (for rate limiting). */
export function countRecentUserApiKeyIssues(
  db: BetterSqlite3.Database,
  windowSeconds = 3600,
  now = Math.floor(Date.now() / 1000),
): number {
  ensureTable(db);
  const since = now - windowSeconds;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM user_api_keys
       WHERE created_at >= ? AND revoked_at IS NULL`,
    )
    .get(since) as { c: number };
  return Number(row?.c || 0);
}

export function listUserApiKeys(
  db: BetterSqlite3.Database,
  options: { includeRevoked?: boolean } = {},
): UserApiKeyRecord[] {
  ensureTable(db);
  const rows = db
    .prepare(
      options.includeRevoked
        ? `SELECT * FROM user_api_keys ORDER BY created_at DESC`
        : `SELECT * FROM user_api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC`,
    )
    .all() as UserApiKeyRow[];
  return rows.map(toRecord);
}

export function revokeUserApiKey(
  db: BetterSqlite3.Database,
  id: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  ensureTable(db);
  const result = db
    .prepare(
      `UPDATE user_api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
    )
    .run(now, id);
  return result.changes > 0;
}

/**
 * Verify a token against the given user's database.
 * Touches `last_used_at` on success so stale keys are visible in the UI.
 */
export function verifyUserApiKey(
  db: BetterSqlite3.Database,
  token: string,
  now = Math.floor(Date.now() / 1000),
): UserApiKeyRecord | null {
  ensureTable(db);
  const expectedHash = hashUserApiKey(token);
  const rows = db
    .prepare(`SELECT * FROM user_api_keys WHERE revoked_at IS NULL`)
    .all() as UserApiKeyRow[];

  const expectedBuf = Buffer.from(expectedHash, 'utf8');
  for (const row of rows) {
    const candidate = Buffer.from(row.key_hash, 'utf8');
    if (candidate.length !== expectedBuf.length) continue;
    if (!timingSafeEqual(candidate, expectedBuf)) continue;
    db.prepare(`UPDATE user_api_keys SET last_used_at = ? WHERE id = ?`).run(
      now,
      row.id,
    );
    return toRecord({ ...row, last_used_at: now });
  }
  return null;
}
