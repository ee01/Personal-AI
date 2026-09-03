import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import type { AgentTaskNotifyTarget } from '../routes/agentTasks.js';

export interface AgentTaskNotifyConfigInput {
  sheetMessageId: string;
  notifyTarget?: AgentTaskNotifyTarget;
  /** 'Y' | 'N'; omit to clear the stored preference. */
  successReceipt?: 'Y' | 'N';
  notifyVia?: 'bot' | 'asme';
  notifyTemplate?: string;
  /** 'Y' | 'N'; omit to let the delivery layer derive it from the task mode. */
  notifyWhenEmpty?: 'Y' | 'N';
}

export interface AgentTaskNotifyConfigRecord {
  sheetMessageId: string;
  notifyTarget?: AgentTaskNotifyTarget;
  successReceipt?: 'Y' | 'N';
  notifyVia?: 'bot' | 'asme';
  notifyTemplate?: string;
  notifyWhenEmpty?: 'Y' | 'N';
  updatedAt: number;
}

interface AgentTaskNotifyConfigRow {
  sheet_message_id: string;
  notify_target_json: string | null;
  success_receipt: string | null;
  notify_via: string | null;
  notify_template: string | null;
  notify_when_empty: string | null;
  updated_at: number;
}

function toYesNo(value: string | null): 'Y' | 'N' | undefined {
  return value === 'Y' || value === 'N' ? value : undefined;
}

function toRecord(row: AgentTaskNotifyConfigRow): AgentTaskNotifyConfigRecord {
  let notifyTarget: AgentTaskNotifyTarget | undefined;
  if (row.notify_target_json) {
    try {
      notifyTarget = JSON.parse(row.notify_target_json) as AgentTaskNotifyTarget;
    } catch {
      notifyTarget = undefined;
    }
  }

  return {
    sheetMessageId: row.sheet_message_id,
    notifyTarget,
    successReceipt: toYesNo(row.success_receipt),
    notifyVia: row.notify_via === 'asme' ? 'asme' : row.notify_via === 'bot' ? 'bot' : undefined,
    notifyTemplate: row.notify_template?.trim() || undefined,
    notifyWhenEmpty: toYesNo(row.notify_when_empty),
    updatedAt: row.updated_at,
  };
}

/**
 * Stores AgentTask result-notification preferences keyed by Sheet row, so they
 * can be registered directly by the extension instead of relying on the
 * deployed Apps Script version to forward every field it currently knows about.
 * See migration 064 for why this exists.
 */
export class AgentTaskNotifyConfigRepository {
  constructor(private readonly db: Database.Database) {}

  get(sheetMessageId: string): AgentTaskNotifyConfigRecord | null {
    const row = this.db
      .prepare(
        `SELECT sheet_message_id, notify_target_json, success_receipt, notify_via,
                notify_template, notify_when_empty, updated_at
         FROM agent_task_notify_configs
         WHERE sheet_message_id = ?`,
      )
      .get(sheetMessageId) as AgentTaskNotifyConfigRow | undefined;

    return row ? toRecord(row) : null;
  }

  upsert(input: AgentTaskNotifyConfigInput): void {
    const notifyTargetJson = input.notifyTarget ? JSON.stringify(input.notifyTarget) : null;
    this.db
      .prepare(
        `INSERT INTO agent_task_notify_configs
           (sheet_message_id, notify_target_json, success_receipt, notify_via,
            notify_template, notify_when_empty, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sheet_message_id) DO UPDATE SET
           notify_target_json = excluded.notify_target_json,
           success_receipt = excluded.success_receipt,
           notify_via = excluded.notify_via,
           notify_template = excluded.notify_template,
           notify_when_empty = excluded.notify_when_empty,
           updated_at = excluded.updated_at`,
      )
      .run(
        input.sheetMessageId,
        notifyTargetJson,
        input.successReceipt ?? null,
        input.notifyVia ?? null,
        input.notifyTemplate?.trim() || null,
        input.notifyWhenEmpty ?? null,
        now(),
      );
  }

  delete(sheetMessageId: string): void {
    this.db
      .prepare('DELETE FROM agent_task_notify_configs WHERE sheet_message_id = ?')
      .run(sheetMessageId);
  }
}
