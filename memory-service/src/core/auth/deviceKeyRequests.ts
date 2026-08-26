/**
 * Pending device-key approval requests for already-claimed namespaces.
 */

import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';

export type DeviceKeyRequestStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'consumed';

export interface DeviceKeyRequestRecord {
  id: string;
  status: DeviceKeyRequestStatus;
  requestedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  deviceLabel: string | null;
  ip: string | null;
  ua: string | null;
  googleEmail: string | null;
  mismatchReason: string | null;
  issuedKeyId: string | null;
}

interface DeviceKeyRequestRow {
  id: string;
  status: string;
  requested_at: number;
  decided_at: number | null;
  decided_by: string | null;
  device_label: string | null;
  ip: string | null;
  ua: string | null;
  google_email: string | null;
  mismatch_reason: string | null;
  issued_key_id: string | null;
}

export function ensureDeviceKeyRequestTable(db: BetterSqlite3.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS device_key_requests (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at INTEGER NOT NULL,
    decided_at INTEGER,
    decided_by TEXT,
    device_label TEXT,
    ip TEXT,
    ua TEXT,
    google_email TEXT,
    mismatch_reason TEXT,
    issued_key_id TEXT
  )`);
}

function toRecord(row: DeviceKeyRequestRow): DeviceKeyRequestRecord {
  return {
    id: row.id,
    status: row.status as DeviceKeyRequestStatus,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    deviceLabel: row.device_label,
    ip: row.ip,
    ua: row.ua,
    googleEmail: row.google_email,
    mismatchReason: row.mismatch_reason,
    issuedKeyId: row.issued_key_id,
  };
}

export function createDeviceKeyRequest(
  db: BetterSqlite3.Database,
  options: {
    deviceLabel?: string | null;
    ip?: string | null;
    ua?: string | null;
    googleEmail?: string | null;
    mismatchReason?: string | null;
    now?: number;
  } = {},
): DeviceKeyRequestRecord {
  ensureDeviceKeyRequestTable(db);
  const id = randomUUID();
  const now = options.now ?? Math.floor(Date.now() / 1000);
  db.prepare(
    `INSERT INTO device_key_requests
      (id, status, requested_at, device_label, ip, ua, google_email, mismatch_reason)
     VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    now,
    options.deviceLabel?.slice(0, 256) || null,
    options.ip?.slice(0, 128) || null,
    options.ua?.slice(0, 256) || null,
    options.googleEmail?.trim().toLowerCase() || null,
    options.mismatchReason?.slice(0, 512) || null,
  );
  return getDeviceKeyRequest(db, id)!;
}

export function getDeviceKeyRequest(
  db: BetterSqlite3.Database,
  id: string,
): DeviceKeyRequestRecord | null {
  ensureDeviceKeyRequestTable(db);
  const row = db
    .prepare(`SELECT * FROM device_key_requests WHERE id = ?`)
    .get(id) as DeviceKeyRequestRow | undefined;
  return row ? toRecord(row) : null;
}

/**
 * Find the most recent approved-but-unconsumed request for a device.
 *
 * `deviceLabel` is a stable per-device fingerprint (platform + a slice of a
 * device id persisted in chrome.storage), unlike a single request's id: an
 * admin decision is durable for the device even if the client that made the
 * original request never carries its requestId forward (e.g. an MV3 service
 * worker that got evicted and restarted before it could poll/consume it).
 */
export function findApprovedDeviceKeyRequestByLabel(
  db: BetterSqlite3.Database,
  deviceLabel: string,
): DeviceKeyRequestRecord | null {
  ensureDeviceKeyRequestTable(db);
  const row = db
    .prepare(
      `SELECT * FROM device_key_requests
       WHERE device_label = ? AND status = 'approved'
       ORDER BY decided_at DESC, rowid DESC
       LIMIT 1`,
    )
    .get(deviceLabel) as DeviceKeyRequestRow | undefined;
  return row ? toRecord(row) : null;
}

export function listDeviceKeyRequests(
  db: BetterSqlite3.Database,
  options: { status?: DeviceKeyRequestStatus } = {},
): DeviceKeyRequestRecord[] {
  ensureDeviceKeyRequestTable(db);
  // requested_at has second precision, so rapid retries from the same
  // device can tie; break ties by rowid (insertion order) so "most recent"
  // is well-defined instead of depending on SQLite's unspecified tie order.
  const rows = (
    options.status
      ? db
          .prepare(
            `SELECT * FROM device_key_requests WHERE status = ? ORDER BY requested_at DESC, rowid DESC`,
          )
          .all(options.status)
      : db
          .prepare(
            `SELECT * FROM device_key_requests ORDER BY requested_at DESC, rowid DESC`,
          )
          .all()
  ) as DeviceKeyRequestRow[];
  return rows.map(toRecord);
}

export function decideDeviceKeyRequest(
  db: BetterSqlite3.Database,
  id: string,
  decision: 'approved' | 'denied',
  decidedBy: string,
  now = Math.floor(Date.now() / 1000),
): DeviceKeyRequestRecord | null {
  ensureDeviceKeyRequestTable(db);
  const result = db
    .prepare(
      `UPDATE device_key_requests
       SET status = ?, decided_at = ?, decided_by = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(decision, now, decidedBy.slice(0, 128), id);
  if (result.changes === 0) return null;
  return getDeviceKeyRequest(db, id);
}

/**
 * Resolve other still-pending requests for the same device with the same
 * decision. A retrying client (e.g. the extension hitting a claimed
 * namespace repeatedly before it gets an approval) creates a new pending row
 * per attempt; once an admin decides on the most recent one, the older
 * pending rows for that device are stale and should not linger forever.
 */
export function decideSiblingDeviceKeyRequests(
  db: BetterSqlite3.Database,
  deviceLabel: string,
  excludeId: string,
  decision: 'approved' | 'denied',
  decidedBy: string,
  now = Math.floor(Date.now() / 1000),
): number {
  ensureDeviceKeyRequestTable(db);
  const result = db
    .prepare(
      `UPDATE device_key_requests
       SET status = ?, decided_at = ?, decided_by = ?
       WHERE device_label = ? AND id != ? AND status = 'pending'`,
    )
    .run(decision, now, decidedBy.slice(0, 128), deviceLabel, excludeId);
  return result.changes;
}

/** Mark an approved request as consumed after a successful key issue. */
export function consumeDeviceKeyRequest(
  db: BetterSqlite3.Database,
  id: string,
  issuedKeyId: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  ensureDeviceKeyRequestTable(db);
  const result = db
    .prepare(
      `UPDATE device_key_requests
       SET status = 'consumed', issued_key_id = ?, decided_at = COALESCE(decided_at, ?)
       WHERE id = ? AND status = 'approved'`,
    )
    .run(issuedKeyId, now, id);
  return result.changes > 0;
}
