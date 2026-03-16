import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

interface WorkerCheckpointRow {
  worker_key: string;
  cursor_value: string | null;
  cursor_type: string;
  updated_at: number;
}

interface WorkerLeaseRow {
  worker_key: string;
  owner_id: string;
  lease_until: number;
  updated_at: number;
}

export class WorkerCheckpointRepository {
  constructor(private readonly db: Database.Database) {}

  get(workerKey: string): { cursorValue: string | null; cursorType: string; updatedAt: number } | null {
    const row = this.db
      .prepare(
        `SELECT worker_key, cursor_value, cursor_type, updated_at
         FROM worker_checkpoints
         WHERE worker_key = ?`,
      )
      .get(workerKey) as WorkerCheckpointRow | undefined;

    if (!row) return null;
    return {
      cursorValue: row.cursor_value,
      cursorType: row.cursor_type,
      updatedAt: row.updated_at,
    };
  }

  getTimestamp(workerKey: string, fallback = 0): number {
    const row = this.get(workerKey);
    if (!row?.cursorValue) return fallback;
    const parsed = Number(row.cursorValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  set(workerKey: string, cursorValue: string | number | null, cursorType = 'timestamp'): void {
    const currentTime = now();
    this.db
      .prepare(
        `INSERT INTO worker_checkpoints (worker_key, cursor_value, cursor_type, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(worker_key) DO UPDATE SET
           cursor_value = excluded.cursor_value,
           cursor_type = excluded.cursor_type,
           updated_at = excluded.updated_at`,
      )
      .run(workerKey, cursorValue != null ? String(cursorValue) : null, cursorType, currentTime);
  }

  acquireLease(workerKey: string, ownerId: string, ttlSeconds: number): boolean {
    const currentTime = now();
    const leaseUntil = currentTime + Math.max(1, ttlSeconds);
    const existing = this.db
      .prepare(
        `SELECT worker_key, owner_id, lease_until, updated_at
         FROM worker_leases
         WHERE worker_key = ?`,
      )
      .get(workerKey) as WorkerLeaseRow | undefined;

    if (existing && existing.lease_until > currentTime && existing.owner_id !== ownerId) {
      return false;
    }

    this.db
      .prepare(
        `INSERT INTO worker_leases (worker_key, owner_id, lease_until, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(worker_key) DO UPDATE SET
           owner_id = excluded.owner_id,
           lease_until = excluded.lease_until,
           updated_at = excluded.updated_at`,
      )
      .run(workerKey, ownerId, leaseUntil, currentTime);
    return true;
  }

  releaseLease(workerKey: string, ownerId: string): void {
    this.db
      .prepare('DELETE FROM worker_leases WHERE worker_key = ? AND owner_id = ?')
      .run(workerKey, ownerId);
  }
}
