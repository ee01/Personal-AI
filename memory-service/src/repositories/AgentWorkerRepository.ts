import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import {
  hashWorkerSecret,
  hashesEqual,
  isWorkerStale,
  type WorkerCapabilities,
  type WorkerHostKind,
  type WorkerStatus,
} from '../integrations/workers/workerProtocol.js';

export interface AgentWorkerRecord {
  id: string;
  label?: string;
  hostname?: string;
  hostKind: WorkerHostKind;
  status: WorkerStatus;
  protocolVersion: number;
  capabilities: WorkerCapabilities;
  credentialHash?: string;
  credentialPrefix?: string;
  lastHeartbeatAt?: number;
  currentTaskCount: number;
  leaseEpoch: number;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
}

export interface AgentWorkerLeaseRecord {
  actionId: string;
  workerId: string;
  fenceToken: number;
  leaseUntil: number;
  createdAt: number;
  updatedAt: number;
}

export interface AgentWorkerCommandRecord {
  id: string;
  workerId: string;
  kind: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'done' | 'expired';
  result?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
  finishedAt?: number;
}

interface WorkerRow {
  id: string;
  label: string | null;
  hostname: string | null;
  host_kind: WorkerHostKind;
  status: WorkerStatus;
  protocol_version: number;
  capabilities_json: string | null;
  credential_hash: string | null;
  credential_prefix: string | null;
  last_heartbeat_at: number | null;
  current_task_count: number;
  lease_epoch: number;
  created_at: number;
  updated_at: number;
  revoked_at: number | null;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class AgentWorkerRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToWorker(row: WorkerRow): AgentWorkerRecord {
    return {
      id: row.id,
      label: row.label ?? undefined,
      hostname: row.hostname ?? undefined,
      hostKind: row.host_kind,
      status: row.status,
      protocolVersion: row.protocol_version,
      capabilities: parseJson<WorkerCapabilities>(row.capabilities_json, {}),
      credentialHash: row.credential_hash ?? undefined,
      credentialPrefix: row.credential_prefix ?? undefined,
      lastHeartbeatAt: row.last_heartbeat_at ?? undefined,
      currentTaskCount: row.current_task_count,
      leaseEpoch: row.lease_epoch,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revokedAt: row.revoked_at ?? undefined,
    };
  }

  insert(input: {
    id: string;
    label?: string;
    hostname?: string;
    hostKind: WorkerHostKind;
    protocolVersion: number;
    capabilities?: WorkerCapabilities;
    credentialHash: string;
    credentialPrefix: string;
  }): AgentWorkerRecord {
    const currentTime = now();
    this.db
      .prepare(
        `INSERT INTO agent_workers
          (id, label, hostname, host_kind, status, protocol_version, capabilities_json,
           credential_hash, credential_prefix, last_heartbeat_at, current_task_count,
           lease_epoch, created_at, updated_at, revoked_at)
         VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)`,
      )
      .run(
        input.id,
        input.label ?? null,
        input.hostname ?? null,
        input.hostKind,
        input.protocolVersion,
        JSON.stringify(input.capabilities ?? { echo: true }),
        input.credentialHash,
        input.credentialPrefix,
        currentTime,
        currentTime,
        currentTime,
      );
    return this.getById(input.id)!;
  }

  getById(id: string): AgentWorkerRecord | null {
    const row = this.db
      .prepare('SELECT * FROM agent_workers WHERE id = ?')
      .get(id) as WorkerRow | undefined;
    return row ? this.rowToWorker(row) : null;
  }

  listActive(): AgentWorkerRecord[] {
    const currentTime = now();
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_workers
         WHERE revoked_at IS NULL
         ORDER BY created_at DESC`,
      )
      .all() as WorkerRow[];
    return rows.map((row) => {
      const worker = this.rowToWorker(row);
      if (
        worker.status !== 'revoked' &&
        isWorkerStale(worker.lastHeartbeatAt, currentTime)
      ) {
        return { ...worker, status: 'stale' };
      }
      return worker;
    });
  }

  verifyCredential(workerId: string, token: string): AgentWorkerRecord | null {
    const worker = this.getById(workerId);
    if (!worker || worker.revokedAt || !worker.credentialHash) return null;
    if (!hashesEqual(hashWorkerSecret(token), worker.credentialHash)) return null;
    return worker;
  }

  heartbeat(
    workerId: string,
    patch: {
      protocolVersion?: number;
      currentTaskCount?: number;
      capabilities?: WorkerCapabilities;
      hostname?: string;
    },
  ): AgentWorkerRecord | null {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE agent_workers
         SET status = 'online',
             last_heartbeat_at = ?,
             protocol_version = COALESCE(?, protocol_version),
             current_task_count = COALESCE(?, current_task_count),
             capabilities_json = COALESCE(?, capabilities_json),
             hostname = COALESCE(?, hostname),
             updated_at = ?
         WHERE id = ? AND revoked_at IS NULL`,
      )
      .run(
        currentTime,
        patch.protocolVersion ?? null,
        patch.currentTaskCount ?? null,
        patch.capabilities ? JSON.stringify(patch.capabilities) : null,
        patch.hostname ?? null,
        currentTime,
        workerId,
      );
    return this.getById(workerId);
  }

  revoke(workerId: string): boolean {
    const currentTime = now();
    const result = this.db
      .prepare(
        `UPDATE agent_workers
         SET status = 'revoked', revoked_at = ?, updated_at = ?, credential_hash = NULL
         WHERE id = ? AND revoked_at IS NULL`,
      )
      .run(currentTime, currentTime, workerId);
    return result.changes > 0;
  }

  createPairingToken(tokenHash: string, expiresAt: number): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO agent_worker_pairing_tokens (id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, tokenHash, expiresAt, now());
    return id;
  }

  consumePairingToken(tokenHash: string): boolean {
    const currentTime = now();
    const row = this.db
      .prepare(
        `SELECT id FROM agent_worker_pairing_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .get(tokenHash, currentTime) as { id: string } | undefined;
    if (!row) return false;
    this.db
      .prepare(
        `UPDATE agent_worker_pairing_tokens SET used_at = ? WHERE id = ?`,
      )
      .run(currentTime, row.id);
    return true;
  }

  nextLeaseEpoch(workerId: string): number {
    this.db
      .prepare(
        `UPDATE agent_workers SET lease_epoch = lease_epoch + 1, updated_at = ? WHERE id = ?`,
      )
      .run(now(), workerId);
    return this.getById(workerId)?.leaseEpoch ?? 0;
  }

  putLease(input: {
    actionId: string;
    workerId: string;
    fenceToken: number;
    leaseUntil: number;
  }): AgentWorkerLeaseRecord {
    const currentTime = now();
    this.db
      .prepare(
        `INSERT INTO agent_worker_leases
          (action_id, worker_id, fence_token, lease_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(action_id) DO UPDATE SET
           worker_id = excluded.worker_id,
           fence_token = excluded.fence_token,
           lease_until = excluded.lease_until,
           updated_at = excluded.updated_at`,
      )
      .run(
        input.actionId,
        input.workerId,
        input.fenceToken,
        input.leaseUntil,
        currentTime,
        currentTime,
      );
    return {
      actionId: input.actionId,
      workerId: input.workerId,
      fenceToken: input.fenceToken,
      leaseUntil: input.leaseUntil,
      createdAt: currentTime,
      updatedAt: currentTime,
    };
  }

  getLease(actionId: string): AgentWorkerLeaseRecord | null {
    const row = this.db
      .prepare('SELECT * FROM agent_worker_leases WHERE action_id = ?')
      .get(actionId) as
      | {
          action_id: string;
          worker_id: string;
          fence_token: number;
          lease_until: number;
          created_at: number;
          updated_at: number;
        }
      | undefined;
    if (!row) return null;
    return {
      actionId: row.action_id,
      workerId: row.worker_id,
      fenceToken: row.fence_token,
      leaseUntil: row.lease_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listExpiredLeases(currentTime = now()): AgentWorkerLeaseRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_worker_leases WHERE lease_until <= ?`,
      )
      .all(currentTime) as Array<{
      action_id: string;
      worker_id: string;
      fence_token: number;
      lease_until: number;
      created_at: number;
      updated_at: number;
    }>;
    return rows.map((row) => ({
      actionId: row.action_id,
      workerId: row.worker_id,
      fenceToken: row.fence_token,
      leaseUntil: row.lease_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  deleteLease(actionId: string): void {
    this.db
      .prepare('DELETE FROM agent_worker_leases WHERE action_id = ?')
      .run(actionId);
  }

  enqueueCommand(input: {
    workerId: string;
    kind: string;
    payload?: Record<string, unknown>;
    expiresAt?: number;
  }): AgentWorkerCommandRecord {
    const id = randomUUID();
    const currentTime = now();
    this.db
      .prepare(
        `INSERT INTO agent_worker_commands
          (id, worker_id, kind, payload_json, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .run(
        id,
        input.workerId,
        input.kind,
        input.payload ? JSON.stringify(input.payload) : null,
        currentTime,
        input.expiresAt ?? null,
      );
    return this.getCommand(id)!;
  }

  getCommand(id: string): AgentWorkerCommandRecord | null {
    const row = this.db
      .prepare('SELECT * FROM agent_worker_commands WHERE id = ?')
      .get(id) as
      | {
          id: string;
          worker_id: string;
          kind: string;
          payload_json: string | null;
          status: 'pending' | 'done' | 'expired';
          result_json: string | null;
          created_at: number;
          expires_at: number | null;
          finished_at: number | null;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      workerId: row.worker_id,
      kind: row.kind,
      payload: parseJson(row.payload_json, undefined),
      status: row.status,
      result: parseJson(row.result_json, undefined),
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
    };
  }

  listPendingCommands(workerId: string): AgentWorkerCommandRecord[] {
    const currentTime = now();
    this.db
      .prepare(
        `UPDATE agent_worker_commands
         SET status = 'expired', finished_at = ?
         WHERE worker_id = ? AND status = 'pending' AND expires_at IS NOT NULL AND expires_at <= ?`,
      )
      .run(currentTime, workerId, currentTime);
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_worker_commands
         WHERE worker_id = ? AND status = 'pending'
         ORDER BY created_at ASC`,
      )
      .all(workerId) as Array<{
      id: string;
      worker_id: string;
      kind: string;
      payload_json: string | null;
      status: 'pending' | 'done' | 'expired';
      result_json: string | null;
      created_at: number;
      expires_at: number | null;
      finished_at: number | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      workerId: row.worker_id,
      kind: row.kind,
      payload: parseJson(row.payload_json, undefined),
      status: row.status,
      result: parseJson(row.result_json, undefined),
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
      finishedAt: row.finished_at ?? undefined,
    }));
  }

  completeCommand(
    id: string,
    result: Record<string, unknown>,
  ): AgentWorkerCommandRecord | null {
    this.db
      .prepare(
        `UPDATE agent_worker_commands
         SET status = 'done', result_json = ?, finished_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(JSON.stringify(result), now(), id);
    return this.getCommand(id);
  }
}
