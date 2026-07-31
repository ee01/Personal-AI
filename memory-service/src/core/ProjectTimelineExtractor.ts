/**
 * ProjectTimelineExtractor
 *
 * Extracts structured project events from messages matched to focus projects
 * and writes bi-temporal entity_properties. Drift receipts are personal-layer
 * observations — never auto-mutate shared roadmap bars.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { getLLMClient } from '../llm/LLMClient.js';
import { now } from '../utils/time.js';
import { listFocusProjects } from './FocusProjectSyncService.js';

export type ProjectEventType =
  | 'date_change'
  | 'risk'
  | 'decision'
  | 'blocker'
  | 'milestone'
  | 'scope_change';

export interface ProjectTimelineEvent {
  id: string;
  projectId: string;
  entityId?: string;
  type: ProjectEventType;
  summary: string;
  fromValue?: string | null;
  toValue?: string | null;
  evidenceMessageId?: string;
  confidence: number;
  createdAt: number;
}

interface ExtractionResult {
  events: Array<{
    projectId: string;
    type: ProjectEventType;
    summary: string;
    fromValue?: string | null;
    toValue?: string | null;
    confidence?: number;
  }>;
}

function ensureDriftTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_drift_receipts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      entity_id TEXT,
      event_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      evidence_message_id TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL,
      resolved_at INTEGER,
      UNIQUE(project_id, event_type, to_value, evidence_message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_drift_open
      ON project_drift_receipts(project_id, status, created_at DESC);
  `);
}

export class ProjectTimelineExtractor {
  constructor(private readonly db: Database.Database) {
    ensureDriftTable(db);
  }

  async extractFromMessage(input: {
    messageId: string;
    content: string;
    matchedProjectIds?: string[];
  }): Promise<ProjectTimelineEvent[]> {
    const focus = listFocusProjects(this.db).filter((p) => p.tier === 'focus');
    if (!focus.length || !input.content?.trim()) return [];

    const candidates = input.matchedProjectIds?.length
      ? focus.filter((p) => input.matchedProjectIds!.includes(p.id))
      : focus;

    if (!candidates.length) return [];

    const catalog = candidates
      .map(
        (p) =>
          `- id=${p.id}; name=${p.displayName || p.name}; key=${p.externalRef?.jiraKey || ''}`,
      )
      .join('\n');

    const llm = getLLMClient();
    let parsed: ExtractionResult;
    try {
      parsed = await llm.generateJSON<ExtractionResult>(
        `Extract project timeline events from the message. Only use projects in the catalog.
Return JSON: {"events":[{"projectId":"...","type":"date_change|risk|decision|blocker|milestone|scope_change","summary":"...","fromValue":null,"toValue":null,"confidence":0.0}]}
If type=date_change, put old/new dates into fromValue/toValue when possible.
If nothing relevant, return {"events":[]}.

Catalog:
${catalog}

Message:
${input.content}`,
        { temperature: 0.1, maxTokens: 700 },
      );
    } catch {
      return [];
    }

    const ts = now();
    const written: ProjectTimelineEvent[] = [];

    for (const event of parsed.events || []) {
      const project = candidates.find((p) => p.id === event.projectId);
      if (!project) continue;
      const confidence = Math.max(0, Math.min(1, Number(event.confidence) || 0.5));
      if (confidence < 0.4) continue;

      const id = randomUUID();
      if (event.type === 'date_change' && project.entityId && event.toValue) {
        this.writeBitemporalProperty({
          entityId: project.entityId,
          key: 'target_end',
          value: String(event.toValue),
          evidenceMessageId: input.messageId,
          confidence,
        });
      }

      // Replace prior open date_change for same project (new evidence wins)
      if (event.type === 'date_change') {
        this.db
          .prepare(
            `UPDATE project_drift_receipts
             SET status = 'superseded', resolved_at = ?
             WHERE project_id = ? AND event_type = 'date_change' AND status = 'open'`,
          )
          .run(ts, project.id);
      }

      try {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO project_drift_receipts (
              id, project_id, entity_id, event_type, summary,
              from_value, to_value, evidence_message_id, confidence,
              status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            project.id,
            project.entityId || null,
            event.type,
            event.summary,
            event.fromValue || null,
            event.toValue || null,
            input.messageId,
            confidence,
            event.type === 'date_change' ? 'open' : 'info',
            ts,
          );
      } catch {
        continue;
      }

      written.push({
        id,
        projectId: project.id,
        entityId: project.entityId,
        type: event.type,
        summary: event.summary,
        fromValue: event.fromValue,
        toValue: event.toValue,
        evidenceMessageId: input.messageId,
        confidence,
        createdAt: ts,
      });
    }

    this.decayStaleReceipts();
    return written;
  }

  listOpenReceipts(projectId?: string) {
    ensureDriftTable(this.db);
    if (projectId) {
      return this.db
        .prepare(
          `SELECT * FROM project_drift_receipts
           WHERE project_id = ? AND status IN ('open', 'info')
           ORDER BY created_at DESC`,
        )
        .all(projectId);
    }
    return this.db
      .prepare(
        `SELECT * FROM project_drift_receipts
         WHERE status IN ('open', 'info')
         ORDER BY created_at DESC
         LIMIT 100`,
      )
      .all();
  }

  resolveReceipt(
    id: string,
    status: 'accepted' | 'ignored' | 'converged' = 'ignored',
  ): void {
    this.db
      .prepare(
        `UPDATE project_drift_receipts
         SET status = ?, resolved_at = ?
         WHERE id = ?`,
      )
      .run(status, now(), id);
  }

  /**
   * Auto-resolve date_change when roadmap bar converges to suggested date (±2 days).
   */
  convergeIfMatches(input: {
    projectId: string;
    barTargetEnd?: string | null;
  }): number {
    if (!input.barTargetEnd) return 0;
    const open = this.db
      .prepare(
        `SELECT * FROM project_drift_receipts
         WHERE project_id = ? AND event_type = 'date_change' AND status = 'open'`,
      )
      .all(input.projectId) as Array<{ id: string; to_value: string | null }>;

    let resolved = 0;
    for (const row of open) {
      if (!row.to_value) continue;
      if (withinDays(input.barTargetEnd, row.to_value, 2)) {
        this.resolveReceipt(row.id, 'converged');
        resolved += 1;
      }
    }
    return resolved;
  }

  private writeBitemporalProperty(input: {
    entityId: string;
    key: string;
    value: string;
    evidenceMessageId: string;
    confidence: number;
  }): void {
    const ts = now();
    this.db
      .prepare(
        `UPDATE entity_properties
         SET tx_end = ?, status = 'superseded'
         WHERE entity_id = ? AND property_key = ?
           AND status = 'active' AND tx_end IS NULL`,
      )
      .run(ts, input.entityId, input.key);

    this.db
      .prepare(
        `INSERT INTO entity_properties (
          entity_id, property_key, property_value, value_type,
          source_message_id, source_authority, valid_from, valid_to,
          tx_start, confidence, status, action_type
        ) VALUES (?, ?, ?, 'date', ?, 'inferred', ?, NULL, ?, ?, 'active', 'update')`,
      )
      .run(
        input.entityId,
        input.key,
        input.value,
        input.evidenceMessageId,
        ts,
        ts,
        input.confidence,
      );
  }

  private decayStaleReceipts(): void {
    const cutoff = now() - 14 * 86_400;
    this.db
      .prepare(
        `UPDATE project_drift_receipts
         SET status = 'expired', resolved_at = ?
         WHERE status IN ('open', 'info') AND created_at < ?`,
      )
      .run(now(), cutoff);
  }
}

function withinDays(a: string, b: string, days: number): boolean {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return a === b;
  return Math.abs(da - db) <= days * 86_400_000;
}
