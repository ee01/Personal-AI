import type Database from 'better-sqlite3';

import { now } from '../utils/time.js';
import { getLLMClient } from '../llm/LLMClient.js';

/**
 * LifecycleService (P1-6 slice C): explicit HTTP-triggered lifecycle operations
 * that complete the six-operation taxonomy (the missing `forgetting` and
 * `compression` faces). Both are **downgrade, not delete** — original content in
 * messages_raw is never removed; only the derived retrieval tier moves, and a
 * compression produces a new summary chunk while archiving (not deleting) the
 * originals. dryRun lets callers preview the impact first.
 */

export interface ForgetOptions {
  scope?: string;
  source?: string;
  sourceType?: string;
  olderThanDays?: number;
  dryRun?: boolean;
}

export interface ForgetResult {
  dryRun: boolean;
  matchedChunks: number;
  matchedMessages: number;
  downgraded: number;
}

export interface CompressOptions {
  entityId?: string;
  topic?: string;
  dryRun?: boolean;
}

export interface CompressResult {
  dryRun: boolean;
  candidateChunks: number;
  compressedInto?: number; // new summary chunk id
  archivedChunks: number;
}

export class LifecycleService {
  constructor(private db: Database.Database) {}

  /** Build the WHERE clause + params for chunk selection from forget filters. */
  private chunkFilter(opts: ForgetOptions): { where: string; params: unknown[] } {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (opts.scope) {
      clauses.push('scope = ?');
      params.push(opts.scope);
    }
    if (opts.source) {
      clauses.push('source = ?');
      params.push(opts.source);
    }
    if (opts.sourceType) {
      clauses.push('source_type = ?');
      params.push(opts.sourceType);
    }
    if (opts.olderThanDays != null) {
      clauses.push('created_at < ?');
      params.push(now() - opts.olderThanDays * 86400);
    }
    return { where: clauses.length ? clauses.join(' AND ') : '1=1', params };
  }

  forget(opts: ForgetOptions): ForgetResult {
    const { where, params } = this.chunkFilter(opts);
    const chunks = this.db
      .prepare(`SELECT chunk_id AS id, related_entity_id FROM chunks WHERE ${where}`)
      .all(...params) as Array<{ id: number | string; related_entity_id: string | null }>;
    const chunkIds = chunks.map((c) => String(c.id));
    const messageIds = [
      ...new Set(chunks.map((c) => c.related_entity_id).filter((x): x is string => !!x)),
    ];

    if (opts.dryRun) {
      return {
        dryRun: true,
        matchedChunks: chunkIds.length,
        matchedMessages: messageIds.length,
        downgraded: 0,
      };
    }

    const nowTs = now();
    const downgrade = this.db.prepare(
      `INSERT INTO memory_metadata
         (target_type, target_id, retrieval_tier, consolidation_level, archived_at,
          archive_reason, created_at, updated_at, lifecycle_updated_at)
       VALUES (?, ?, 'archive_only', 'archived', ?, 'manual_forget', ?, ?, ?)
       ON CONFLICT(target_type, target_id) DO UPDATE SET
         retrieval_tier = 'archive_only',
         consolidation_level = 'archived',
         archived_at = excluded.archived_at,
         archive_reason = 'manual_forget',
         updated_at = excluded.updated_at,
         lifecycle_updated_at = excluded.lifecycle_updated_at`,
    );
    let downgraded = 0;
    const tx = this.db.transaction(() => {
      for (const id of chunkIds) {
        downgrade.run('chunk', id, nowTs, nowTs, nowTs, nowTs);
        downgraded += 1;
      }
      for (const id of messageIds) {
        downgrade.run('message', id, nowTs, nowTs, nowTs, nowTs);
        downgraded += 1;
      }
    });
    tx();
    return {
      dryRun: false,
      matchedChunks: chunkIds.length,
      matchedMessages: messageIds.length,
      downgraded,
    };
  }

  async compress(opts: CompressOptions): Promise<CompressResult> {
    if (!opts.entityId && !opts.topic) {
      throw new Error('compress requires entityId or topic');
    }
    // Gather weak/archive_only chunks for the target. Topic falls back to a LIKE
    // on chunk content; entityId uses the related_entity_id link.
    let rows: Array<{ id: number | string; content: string; scope: string | null; source: string | null }>;
    if (opts.entityId) {
      rows = this.db
        .prepare(
          `SELECT c.chunk_id AS id, c.content, c.scope, c.source
             FROM chunks c
             JOIN memory_metadata mm ON mm.target_type = 'chunk' AND mm.target_id = CAST(c.chunk_id AS TEXT)
            WHERE c.related_entity_id = ?
              AND mm.retrieval_tier IN ('weak', 'archive_only')`,
        )
        .all(opts.entityId) as typeof rows;
    } else {
      rows = this.db
        .prepare(
          `SELECT c.chunk_id AS id, c.content, c.scope, c.source
             FROM chunks c
             JOIN memory_metadata mm ON mm.target_type = 'chunk' AND mm.target_id = CAST(c.chunk_id AS TEXT)
            WHERE c.content LIKE ?
              AND mm.retrieval_tier IN ('weak', 'archive_only')`,
        )
        .all(`%${opts.topic}%`) as typeof rows;
    }

    if (opts.dryRun || rows.length === 0) {
      return { dryRun: !!opts.dryRun, candidateChunks: rows.length, archivedChunks: 0 };
    }

    // Summarize into one chunk (best-effort LLM; fallback to a joined digest).
    const joined = rows.map((r) => `- ${r.content}`).join('\n').slice(0, 6000);
    let summary: string;
    try {
      const llm = getLLMClient();
      const resp = await llm.generate(
        `把以下关于「${opts.entityId ?? opts.topic}」的零散旧记忆压缩成一段简洁、保真的中文摘要（不要编造）：\n\n${joined}`,
        { maxTokens: 400 },
      );
      summary = resp.content?.trim() || joined.slice(0, 1000);
    } catch {
      summary = joined.slice(0, 1000);
    }

    const nowTs = now();
    const scope = rows[0]?.scope ?? 'work';
    const source = rows[0]?.source ?? 'compression';
    let newChunkId = 0;
    const tx = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO chunks
             (file_path, line_start, line_end, content, content_hash, scope, source,
              source_type, related_entity_id, token_count, created_at)
           VALUES (?, 0, 0, ?, ?, ?, ?, 'compression', ?, ?, ?)`,
        )
        .run(
          `compression/${opts.entityId ?? opts.topic}`,
          summary,
          `compress-${nowTs}`,
          scope,
          source,
          opts.entityId ?? null,
          Math.ceil(summary.length / 4),
          nowTs,
        );
      newChunkId = Number(info.lastInsertRowid);
      // The summary chunk is a consolidated memory.
      this.db
        .prepare(
          `INSERT INTO memory_metadata
             (target_type, target_id, salience_score, retrieval_tier, effective_salience,
              consolidation_level, created_at, updated_at, lifecycle_updated_at)
           VALUES ('chunk', ?, 0.5, 'active', 0.5, 'consolidated', ?, ?, ?)`,
        )
        .run(String(newChunkId), nowTs, nowTs, nowTs);
      // Archive the originals (downgrade, not delete).
      const arch = this.db.prepare(
        `INSERT INTO memory_metadata
           (target_type, target_id, retrieval_tier, consolidation_level, archived_at,
            archive_reason, archive_ref, created_at, updated_at, lifecycle_updated_at)
         VALUES ('chunk', ?, 'archive_only', 'archived', ?, 'compressed', ?, ?, ?, ?)
         ON CONFLICT(target_type, target_id) DO UPDATE SET
           retrieval_tier = 'archive_only',
           consolidation_level = 'archived',
           archived_at = excluded.archived_at,
           archive_reason = 'compressed',
           archive_ref = excluded.archive_ref,
           updated_at = excluded.updated_at,
           lifecycle_updated_at = excluded.lifecycle_updated_at`,
      );
      for (const r of rows) {
        arch.run(String(r.id), nowTs, String(newChunkId), nowTs, nowTs, nowTs);
      }
    });
    tx();

    return {
      dryRun: false,
      candidateChunks: rows.length,
      compressedInto: newChunkId,
      archivedChunks: rows.length,
    };
  }
}
