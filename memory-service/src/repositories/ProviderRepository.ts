import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

interface ProviderBindingRow {
  id: string;
  provider: string;
  binding_type: string;
  external_thread_id: string;
  title: string | null;
  device_id: string | null;
  metadata_json: string | null;
  is_active: number;
  last_synced_at: number | null;
  last_sync_job_id: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

interface ProviderSyncJobRow {
  id: string;
  provider: string;
  scenario: string;
  binding_type: string;
  binding_id: string | null;
  title: string | null;
  status: string;
  request_json: string;
  response_json: string | null;
  result_json: string | null;
  error_message: string | null;
  dedupe_key: string | null;
  source_refs_json: string | null;
  token_budget: number | null;
  freshness_window_days: number | null;
  device_context: string | null;
  external_thread_id: string | null;
  provider_message_id: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ProviderBindingRecord {
  id: string;
  provider: string;
  bindingType: string;
  externalThreadId: string;
  title?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  lastSyncedAt?: number;
  lastSyncJobId?: string;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderBindingUpsertInput {
  externalThreadId: string;
  title?: string;
  deviceId?: string;
  metadata?: Record<string, any>;
  isActive?: boolean;
  lastError?: string | null;
}

export interface ProviderSyncJobRecord {
  id: string;
  provider: string;
  scenario: string;
  bindingType: string;
  bindingId?: string;
  title?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'skipped';
  request: Record<string, any>;
  response?: Record<string, any>;
  result?: Record<string, any>;
  errorMessage?: string;
  dedupeKey?: string;
  sourceRefs: string[];
  tokenBudget?: number;
  freshnessWindowDays?: number;
  deviceContext?: string;
  externalThreadId?: string;
  providerMessageId?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderSyncJobCreateInput {
  provider: string;
  scenario: string;
  bindingType: string;
  bindingId?: string;
  title?: string;
  status?: ProviderSyncJobRecord['status'];
  request: Record<string, any>;
  response?: Record<string, any>;
  dedupeKey?: string;
  sourceRefs?: string[];
  tokenBudget?: number;
  freshnessWindowDays?: number;
  deviceContext?: string;
  externalThreadId?: string;
  providerMessageId?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface ProviderSyncJobFilters {
  status?: ProviderSyncJobRecord['status'] | 'all';
  bindingType?: string;
  limit?: number;
  offset?: number;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toBindingRecord(row: ProviderBindingRow): ProviderBindingRecord {
  return {
    id: row.id,
    provider: row.provider,
    bindingType: row.binding_type,
    externalThreadId: row.external_thread_id,
    title: row.title ?? undefined,
    deviceId: row.device_id ?? undefined,
    metadata: safeJsonParse<Record<string, any> | undefined>(row.metadata_json, undefined),
    isActive: row.is_active === 1,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastSyncJobId: row.last_sync_job_id ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSyncJobRecord(row: ProviderSyncJobRow): ProviderSyncJobRecord {
  return {
    id: row.id,
    provider: row.provider,
    scenario: row.scenario,
    bindingType: row.binding_type,
    bindingId: row.binding_id ?? undefined,
    title: row.title ?? undefined,
    status: row.status as ProviderSyncJobRecord['status'],
    request: safeJsonParse<Record<string, any>>(row.request_json, {}),
    response: safeJsonParse<Record<string, any> | undefined>(row.response_json, undefined),
    result: safeJsonParse<Record<string, any> | undefined>(row.result_json, undefined),
    errorMessage: row.error_message ?? undefined,
    dedupeKey: row.dedupe_key ?? undefined,
    sourceRefs: safeJsonParse<string[]>(row.source_refs_json, []),
    tokenBudget: row.token_budget ?? undefined,
    freshnessWindowDays: row.freshness_window_days ?? undefined,
    deviceContext: row.device_context ?? undefined,
    externalThreadId: row.external_thread_id ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProviderRepository {
  constructor(private readonly db: Database.Database) {}

  listBindings(provider: string, bindingType?: string): ProviderBindingRecord[] {
    const conditions = ['provider = ?'];
    const params: unknown[] = [provider];

    if (bindingType) {
      conditions.push('binding_type = ?');
      params.push(bindingType);
    }

    const rows = this.db
      .prepare(
        `SELECT *
         FROM provider_bindings
         WHERE ${conditions.join(' AND ')}
         ORDER BY updated_at DESC, created_at DESC`,
      )
      .all(...params) as ProviderBindingRow[];

    return rows.map(toBindingRecord);
  }

  getBinding(provider: string, bindingType: string): ProviderBindingRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM provider_bindings
         WHERE provider = ? AND binding_type = ?
         LIMIT 1`,
      )
      .get(provider, bindingType) as ProviderBindingRow | undefined;

    return row ? toBindingRecord(row) : null;
  }

  upsertBinding(
    provider: string,
    bindingType: string,
    input: ProviderBindingUpsertInput,
  ): ProviderBindingRecord {
    const current = this.getBinding(provider, bindingType);
    const timestamp = now();

    if (current) {
      this.db
        .prepare(
          `UPDATE provider_bindings
           SET external_thread_id = ?,
               title = ?,
               device_id = ?,
               metadata_json = ?,
               is_active = ?,
               last_error = ?,
               updated_at = ?
           WHERE provider = ? AND binding_type = ?`,
        )
        .run(
          input.externalThreadId,
          input.title ?? null,
          input.deviceId ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.isActive === false ? 0 : 1,
          input.lastError ?? null,
          timestamp,
          provider,
          bindingType,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO provider_bindings
            (id, provider, binding_type, external_thread_id, title, device_id, metadata_json, is_active, last_error, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          provider,
          bindingType,
          input.externalThreadId,
          input.title ?? null,
          input.deviceId ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.isActive === false ? 0 : 1,
          input.lastError ?? null,
          timestamp,
          timestamp,
        );
    }

    return this.getBinding(provider, bindingType)!;
  }

  listSyncJobs(provider: string, filters: ProviderSyncJobFilters = {}): {
    items: ProviderSyncJobRecord[];
    total: number;
  } {
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const conditions = ['provider = ?'];
    const params: unknown[] = [provider];

    if (filters.status && filters.status !== 'all') {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.bindingType) {
      conditions.push('binding_type = ?');
      params.push(filters.bindingType);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const total = (
      this.db
        .prepare(`SELECT COUNT(*) AS count FROM provider_sync_jobs ${whereClause}`)
        .get(...params) as { count: number }
    ).count;

    const rows = this.db
      .prepare(
        `SELECT *
         FROM provider_sync_jobs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as ProviderSyncJobRow[];

    return {
      items: rows.map(toSyncJobRecord),
      total,
    };
  }

  getSyncJob(provider: string, id: string): ProviderSyncJobRecord | null {
    const row = this.db
      .prepare(
        `SELECT *
         FROM provider_sync_jobs
         WHERE provider = ? AND id = ?
         LIMIT 1`,
      )
      .get(provider, id) as ProviderSyncJobRow | undefined;

    return row ? toSyncJobRecord(row) : null;
  }

  createSyncJob(input: ProviderSyncJobCreateInput): ProviderSyncJobRecord {
    const timestamp = now();
    const id = randomUUID();
    const requestJson = JSON.stringify(input.request);
    const responseJson = input.response ? JSON.stringify(input.response) : null;
    const sourceRefsJson = input.sourceRefs ? JSON.stringify(input.sourceRefs) : null;

    this.db
      .prepare(
        `INSERT INTO provider_sync_jobs
          (id, provider, scenario, binding_type, binding_id, title, status, request_json,
           response_json, dedupe_key, source_refs_json, token_budget, freshness_window_days,
           device_context, external_thread_id, provider_message_id, started_at, completed_at,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.provider,
        input.scenario,
        input.bindingType,
        input.bindingId ?? null,
        input.title ?? null,
        input.status ?? 'queued',
        requestJson,
        responseJson,
        input.dedupeKey ?? null,
        sourceRefsJson,
        input.tokenBudget ?? null,
        input.freshnessWindowDays ?? null,
        input.deviceContext ?? null,
        input.externalThreadId ?? null,
        input.providerMessageId ?? null,
        input.startedAt ?? null,
        input.completedAt ?? null,
        timestamp,
        timestamp,
      );

    return this.getSyncJob(input.provider, id)!;
  }

  reportSyncJob(
    provider: string,
    id: string,
    input: {
      status: ProviderSyncJobRecord['status'];
      result?: Record<string, any>;
      errorMessage?: string;
      response?: Record<string, any>;
      providerMessageId?: string;
      externalThreadId?: string;
      completedAt?: number;
      startedAt?: number;
    },
  ): ProviderSyncJobRecord {
    const current = this.getSyncJob(provider, id);
    if (!current) {
      throw new Error(`Provider sync job "${id}" not found for provider "${provider}"`);
    }

    const timestamp = now();
    const finalTimestamp = input.completedAt ?? timestamp;

    this.db
      .prepare(
        `UPDATE provider_sync_jobs
         SET status = ?,
             result_json = ?,
             error_message = ?,
             response_json = ?,
             provider_message_id = ?,
             external_thread_id = ?,
             started_at = COALESCE(?, started_at),
             completed_at = ?,
             updated_at = ?
         WHERE provider = ? AND id = ?`,
      )
      .run(
        input.status,
        input.result ? JSON.stringify(input.result) : null,
        input.errorMessage ?? null,
        input.response ? JSON.stringify(input.response) : null,
        input.providerMessageId ?? null,
        input.externalThreadId ?? null,
        input.startedAt ?? null,
        input.status === 'queued' || input.status === 'running' ? null : finalTimestamp,
        timestamp,
        provider,
        id,
      );

    const updated = this.getSyncJob(provider, id)!;

    const bindingType = current.bindingType;
    const binding = this.getBinding(provider, bindingType);
    if (binding) {
      if (input.status === 'succeeded') {
        this.db
          .prepare(
            `UPDATE provider_bindings
             SET last_synced_at = ?, last_sync_job_id = ?, last_error = ?, updated_at = ?
             WHERE provider = ? AND binding_type = ?`,
          )
          .run(timestamp, id, null, timestamp, provider, bindingType);
      } else if (input.status === 'failed') {
        this.db
          .prepare(
            `UPDATE provider_bindings
             SET last_error = ?, updated_at = ?
             WHERE provider = ? AND binding_type = ?`,
          )
          .run(input.errorMessage ?? 'Sync failed', timestamp, provider, bindingType);
      }
    }

    return updated;
  }
}
