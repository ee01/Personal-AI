import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';

export interface ActionResultRecord {
  id: string;
  actionId: string;
  threadId: string;
  runId?: string;
  resultType: string;
  summary: string;
  payload?: Record<string, unknown>;
  transcriptPath?: string;
  createdAt: number;
}

interface ActionResultRow {
  id: string;
  action_id: string;
  thread_id: string;
  run_id: string | null;
  result_type: string;
  summary: string;
  payload_json: string | null;
  transcript_path: string | null;
  created_at: number;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export interface CreateActionResultInput {
  id?: string;
  actionId: string;
  threadId: string;
  runId?: string;
  resultType: string;
  summary: string;
  payload?: Record<string, unknown>;
  transcriptPath?: string;
  createdAt?: number;
}

export class ActionResultRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToRecord(row: ActionResultRow): ActionResultRecord {
    return {
      id: row.id,
      actionId: row.action_id,
      threadId: row.thread_id,
      runId: row.run_id ?? undefined,
      resultType: row.result_type,
      summary: row.summary,
      payload: safeJsonParse<Record<string, unknown> | undefined>(row.payload_json, undefined),
      transcriptPath: row.transcript_path ?? undefined,
      createdAt: row.created_at,
    };
  }

  create(input: CreateActionResultInput): ActionResultRecord {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.db
      .prepare(
        `INSERT INTO action_results
          (id, action_id, thread_id, run_id, result_type, summary, payload_json, transcript_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.actionId,
        input.threadId,
        input.runId ?? null,
        input.resultType,
        input.summary,
        input.payload ? JSON.stringify(input.payload) : null,
        input.transcriptPath ?? null,
        createdAt,
      );

    return this.getById(id)!;
  }

  getById(id: string): ActionResultRecord | null {
    const row = this.db
      .prepare('SELECT * FROM action_results WHERE id = ?')
      .get(id) as ActionResultRow | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  listByThread(threadId: string, limit = 20): ActionResultRecord[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM action_results
         WHERE thread_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(threadId, Math.max(1, Math.min(limit, 100))) as ActionResultRow[];
    return rows.map((row) => this.rowToRecord(row));
  }
}
