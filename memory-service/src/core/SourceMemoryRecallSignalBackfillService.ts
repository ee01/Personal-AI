import fs from 'node:fs';
import path from 'node:path';

import type BetterSqlite3 from 'better-sqlite3';

import { classifyTrust, screenForInjection } from './injectionScreen.js';
import { MemoryClaimAttributionService } from './MemoryClaimAttributionService.js';
import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';

const BACKFILL_VERSION = 1;
const CAPSULE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

interface SourceMemoryBackfillRow {
  id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  source_host: string | null;
  capture_mode: string;
  scope: string;
  summary: string | null;
  message_id: string | null;
  metadata_json: string | null;
  created_at: number;
  saved_at: number | null;
}

interface SourceMemoryChunkRow {
  chunk_id: number;
  related_entity_id: string | null;
}

interface PreparedTarget {
  row: SourceMemoryBackfillRow;
  content: string;
  chunks: ReturnType<typeof chunkText>;
  existingChunks: SourceMemoryChunkRow[];
  messageMetadataMissing: boolean;
  missingChunkMetadata: number;
}

interface IntegrityQueryRow {
  saved_capsules: number;
  missing_message_rows: number;
  mismatched_message_sources: number;
  capsules_without_chunks: number;
  chunk_link_mismatch_capsules: number;
  missing_message_metadata: number;
}

interface ChunkIntegrityQueryRow {
  source_memory_chunks: number;
  missing_chunk_metadata: number;
}

export interface SourceMemoryRecallIntegritySnapshot {
  savedCapsules: number;
  missingMessageRows: number;
  mismatchedMessageSources: number;
  capsulesWithoutChunks: number;
  chunkLinkMismatchCapsules: number;
  sourceMemoryChunks: number;
  missingMessageMetadata: number;
  missingChunkMetadata: number;
  healthy: boolean;
}

export interface SourceMemoryRecallSignalBackfillOptions {
  apply?: boolean;
  expectedTargets?: number;
  runId?: string;
  includeTargetIds?: boolean;
}

export interface SourceMemoryRecallSignalBackfillResult {
  mode: 'dry_run' | 'apply';
  runId: string;
  targetCount: number;
  targetCapsuleIds?: string[];
  canApply: boolean;
  blockers: string[];
  planned: {
    messageRows: number;
    newChunks: number;
    messageMetadataRows: number;
    chunkMetadataRows: number;
  };
  applied: {
    messageRows: number;
    newChunks: number;
    messageMetadataRows: number;
    chunkMetadataRows: number;
    insertedChunkIds: number[];
  };
  integrityBefore: SourceMemoryRecallIntegritySnapshot;
  integrityAfter?: SourceMemoryRecallIntegritySnapshot;
}

export class SourceMemoryRecallSignalBackfillService {
  constructor(
    private readonly db: BetterSqlite3.Database,
    private readonly sourceMemoryDir: string,
  ) {}

  inspectIntegrity(): SourceMemoryRecallIntegritySnapshot {
    const capsuleRow = this.db
      .prepare(
        `SELECT
           COUNT(*) AS saved_capsules,
           SUM(CASE WHEN m.id IS NULL THEN 1 ELSE 0 END) AS missing_message_rows,
           SUM(CASE
             WHEN m.id IS NOT NULL
              AND COALESCE(m.source, '') <> 'source-memory:' || c.id
             THEN 1 ELSE 0 END) AS mismatched_message_sources,
           SUM(CASE WHEN NOT EXISTS (
             SELECT 1 FROM chunks ch
             WHERE ch.file_path = 'source-memory/' || c.id || '.md'
           ) THEN 1 ELSE 0 END) AS capsules_without_chunks,
           SUM(CASE WHEN EXISTS (
             SELECT 1 FROM chunks ch
             WHERE ch.file_path = 'source-memory/' || c.id || '.md'
               AND COALESCE(ch.related_entity_id, '') <> COALESCE(c.message_id, '')
           ) THEN 1 ELSE 0 END) AS chunk_link_mismatch_capsules,
           SUM(CASE WHEN NOT EXISTS (
             SELECT 1 FROM memory_metadata mm
             WHERE mm.target_type = 'message'
               AND mm.target_id = c.message_id
           ) THEN 1 ELSE 0 END) AS missing_message_metadata
         FROM source_memory_capsules c
         LEFT JOIN messages_raw m ON m.id = c.message_id
         WHERE c.status = 'saved'`,
      )
      .get() as IntegrityQueryRow;

    const chunkRow = this.db
      .prepare(
        `SELECT
           COUNT(*) AS source_memory_chunks,
           SUM(CASE WHEN NOT EXISTS (
             SELECT 1 FROM memory_metadata mm
             WHERE mm.target_type = 'chunk'
               AND mm.target_id = CAST(ch.chunk_id AS TEXT)
           ) THEN 1 ELSE 0 END) AS missing_chunk_metadata
         FROM chunks ch
         JOIN source_memory_capsules c
           ON ch.file_path = 'source-memory/' || c.id || '.md'
         WHERE c.status = 'saved'`,
      )
      .get() as ChunkIntegrityQueryRow;

    const snapshot: SourceMemoryRecallIntegritySnapshot = {
      savedCapsules: Number(capsuleRow.saved_capsules ?? 0),
      missingMessageRows: Number(capsuleRow.missing_message_rows ?? 0),
      mismatchedMessageSources: Number(
        capsuleRow.mismatched_message_sources ?? 0,
      ),
      capsulesWithoutChunks: Number(capsuleRow.capsules_without_chunks ?? 0),
      chunkLinkMismatchCapsules: Number(
        capsuleRow.chunk_link_mismatch_capsules ?? 0,
      ),
      sourceMemoryChunks: Number(chunkRow.source_memory_chunks ?? 0),
      missingMessageMetadata: Number(
        capsuleRow.missing_message_metadata ?? 0,
      ),
      missingChunkMetadata: Number(chunkRow.missing_chunk_metadata ?? 0),
      healthy: false,
    };
    snapshot.healthy =
      snapshot.missingMessageRows === 0 &&
      snapshot.mismatchedMessageSources === 0 &&
      snapshot.capsulesWithoutChunks === 0 &&
      snapshot.chunkLinkMismatchCapsules === 0 &&
      snapshot.missingMessageMetadata === 0 &&
      snapshot.missingChunkMetadata === 0;
    return snapshot;
  }

  run(
    options: SourceMemoryRecallSignalBackfillOptions = {},
  ): SourceMemoryRecallSignalBackfillResult {
    const runId = normalizeRunId(
      options.runId ?? `source-memory-recall-${now()}`,
    );
    const integrityBefore = this.inspectIntegrity();
    const { targets, blockers } = this.prepareTargets();
    if (integrityBefore.mismatchedMessageSources > 0) {
      blockers.push(
        `${integrityBefore.mismatchedMessageSources} saved capsules point to a message row with a mismatched source.`,
      );
    }
    if (integrityBefore.chunkLinkMismatchCapsules > 0) {
      blockers.push(
        `${integrityBefore.chunkLinkMismatchCapsules} saved capsules have chunks linked to a different message id.`,
      );
    }

    const planned = {
      messageRows: targets.length,
      newChunks: targets.reduce(
        (total, target) =>
          total + (target.existingChunks.length === 0 ? target.chunks.length : 0),
        0,
      ),
      messageMetadataRows: targets.filter(
        (target) => target.messageMetadataMissing,
      ).length,
      chunkMetadataRows: targets.reduce(
        (total, target) =>
          total +
          (target.existingChunks.length === 0
            ? target.chunks.length
            : target.missingChunkMetadata),
        0,
      ),
    };
    const targetCapsulesWithoutChunks = targets.filter(
      (target) => target.existingChunks.length === 0,
    ).length;
    const targetExistingChunksWithoutMetadata = targets.reduce(
      (total, target) => total + target.missingChunkMetadata,
      0,
    );
    if (
      integrityBefore.capsulesWithoutChunks > targetCapsulesWithoutChunks
    ) {
      blockers.push(
        'At least one chunkless saved capsule is outside the missing-message target set.',
      );
    }
    if (
      integrityBefore.missingMessageMetadata > planned.messageMetadataRows
    ) {
      blockers.push(
        'At least one saved capsule with an existing message is missing message metadata.',
      );
    }
    if (
      integrityBefore.missingChunkMetadata >
      targetExistingChunksWithoutMetadata
    ) {
      blockers.push(
        'At least one saved Source Memory chunk outside the target set is missing metadata.',
      );
    }

    const baseResult: SourceMemoryRecallSignalBackfillResult = {
      mode: options.apply ? 'apply' : 'dry_run',
      runId,
      targetCount: targets.length,
      targetCapsuleIds: options.includeTargetIds
        ? targets.map((target) => target.row.id)
        : undefined,
      canApply: blockers.length === 0,
      blockers,
      planned,
      applied: {
        messageRows: 0,
        newChunks: 0,
        messageMetadataRows: 0,
        chunkMetadataRows: 0,
        insertedChunkIds: [],
      },
      integrityBefore,
    };

    if (!options.apply) return baseResult;
    if (!Number.isInteger(options.expectedTargets)) {
      throw new Error('Apply requires --expected-targets with the dry-run count.');
    }
    if (options.expectedTargets !== targets.length) {
      throw new Error(
        `Expected ${options.expectedTargets} targets, but the current transaction would repair ${targets.length}.`,
      );
    }
    if (blockers.length > 0) {
      throw new Error(`Backfill blocked: ${blockers.join(' ')}`);
    }

    const applied = {
      messageRows: 0,
      newChunks: 0,
      messageMetadataRows: 0,
      chunkMetadataRows: 0,
      insertedChunkIds: [] as number[],
    };

    let integrityAfter: SourceMemoryRecallIntegritySnapshot | undefined;
    const applyTransaction = this.db.transaction(() => {
      for (const target of targets) {
        this.applyTarget(target, runId, applied);
      }
      integrityAfter = this.inspectIntegrity();
      if (!integrityAfter.healthy) {
        throw new Error(
          `Integrity remained unhealthy after backfill: ${JSON.stringify(integrityAfter)}`,
        );
      }
    });
    applyTransaction.immediate();

    return {
      ...baseResult,
      applied,
      integrityAfter,
    };
  }

  private prepareTargets(): { targets: PreparedTarget[]; blockers: string[] } {
    const rows = this.db
      .prepare(
        `SELECT
           c.id, c.source_kind, c.source_url, c.source_title, c.source_host,
           c.capture_mode, c.scope, c.summary, c.message_id, c.metadata_json,
           c.created_at, c.saved_at
         FROM source_memory_capsules c
         LEFT JOIN messages_raw m ON m.id = c.message_id
         WHERE c.status = 'saved' AND m.id IS NULL
         ORDER BY c.created_at ASC, c.id ASC`,
      )
      .all() as SourceMemoryBackfillRow[];

    const blockers: string[] = [];
    const targets: PreparedTarget[] = [];
    const getChunks = this.db.prepare(
      `SELECT chunk_id, related_entity_id
       FROM chunks
       WHERE file_path = ?
       ORDER BY line_start ASC, chunk_id ASC`,
    );
    const hasMetadata = this.db.prepare(
      `SELECT 1 AS present
       FROM memory_metadata
       WHERE target_type = ? AND target_id = ?
       LIMIT 1`,
    );

    for (const row of rows) {
      if (!CAPSULE_ID_PATTERN.test(row.id)) {
        blockers.push(`Capsule id is unsafe for snapshot lookup: ${row.id}`);
        continue;
      }
      const messageId = row.message_id?.trim();
      if (!messageId) {
        blockers.push(`Capsule ${row.id} has no message id to restore.`);
        continue;
      }

      const snapshotPath = path.join(this.sourceMemoryDir, `${row.id}.md`);
      if (!fs.existsSync(snapshotPath)) {
        blockers.push(`Capsule ${row.id} has no Markdown snapshot.`);
        continue;
      }
      const content = fs.readFileSync(snapshotPath, 'utf8');
      if (!content.trim()) {
        blockers.push(`Capsule ${row.id} has an empty Markdown snapshot.`);
        continue;
      }

      const existingChunks = getChunks.all(
        `source-memory/${row.id}.md`,
      ) as SourceMemoryChunkRow[];
      const mismatchedChunk = existingChunks.find(
        (chunk) => chunk.related_entity_id !== messageId,
      );
      if (mismatchedChunk) {
        blockers.push(
          `Capsule ${row.id} has chunk ${mismatchedChunk.chunk_id} linked to a different message id.`,
        );
        continue;
      }

      const chunks = chunkText(content, 220, 40);
      if (existingChunks.length === 0 && chunks.length === 0) {
        blockers.push(`Capsule ${row.id} could not produce a recall chunk.`);
        continue;
      }
      const messageMetadataMissing = !hasMetadata.get('message', messageId);
      const missingChunkMetadata = existingChunks.filter(
        (chunk) => !hasMetadata.get('chunk', String(chunk.chunk_id)),
      ).length;
      targets.push({
        row,
        content,
        chunks,
        existingChunks,
        messageMetadataMissing,
        missingChunkMetadata,
      });
    }

    return { targets, blockers };
  }

  private applyTarget(
    target: PreparedTarget,
    runId: string,
    applied: SourceMemoryRecallSignalBackfillResult['applied'],
  ): void {
    const { row, content } = target;
    const messageId = row.message_id as string;
    const timestamp = row.saved_at ?? row.created_at;
    const appliedAt = now();
    const messageImportance = getCaptureModeMessageImportance(row.capture_mode);
    const chunkImportance = Math.max(0.45, messageImportance - 0.04);
    const trustClass = classifyTrust('web');
    const screen = screenForInjection(content);
    const injectionFlagsJson = screen.flagged
      ? JSON.stringify(screen.flags)
      : null;
    const capsuleMetadata = parseObject(row.metadata_json);
    const { distillation: _distillation, ...sourceMetadata } = capsuleMetadata;
    const metadata = {
      ...sourceMetadata,
      // A captured webpage is external evidence even when the user explicitly
      // chose to save it. Preserve that owner boundary for claim attribution.
      authorRole: 'external',
      isSelf: false,
      captureMode: sourceMetadata.captureMode ?? row.capture_mode,
      sourceKind: sourceMetadata.sourceKind ?? row.source_kind,
      sourceHost: sourceMetadata.sourceHost ?? row.source_host ?? undefined,
      sourceMemoryCapsuleId: row.id,
      captureLayer: 'memory_capture',
      sourceMemoryRecallSignalBackfill: {
        version: BACKFILL_VERSION,
        runId,
        appliedAt,
      },
    };

    const messageResult = this.db
      .prepare(
        `INSERT INTO messages_raw (
           id, content, summary, scope, source, source_type, source_url,
           source_title, sender, group_id, group_name, timestamp,
           importance, sentiment, metadata_json, trust_class,
           injection_flags_json, claim_attribution_status,
           claim_attribution_version, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'web', ?, ?, 'Memory Capture', ?, ?, ?, ?,
           'neutral', ?, ?, ?, 'pending', 1, ?, ?)`,
      )
      .run(
        messageId,
        content,
        row.summary,
        normalizeScope(row.scope),
        `source-memory:${row.id}`,
        row.source_url,
        row.source_title,
        row.source_host,
        row.source_host,
        timestamp,
        messageImportance,
        JSON.stringify(metadata),
        trustClass,
        injectionFlagsJson,
        timestamp,
        timestamp,
      );
    if (messageResult.changes !== 1) {
      throw new Error(`Failed to restore message row for capsule ${row.id}.`);
    }
    applied.messageRows += 1;

    const insertMetadata = this.db.prepare(
      `INSERT INTO memory_metadata (
         target_type, target_id, salience_score, importance,
         consolidation_level, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'working', ?, ?)
       ON CONFLICT(target_type, target_id) DO NOTHING`,
    );
    const messageMetadataResult = insertMetadata.run(
      'message',
      messageId,
      messageImportance,
      messageImportance,
      timestamp,
      timestamp,
    );
    applied.messageMetadataRows += messageMetadataResult.changes;

    let chunkRows = target.existingChunks;
    if (chunkRows.length === 0) {
      const insertChunk = this.db.prepare(
        `INSERT INTO chunks (
           file_path, line_start, line_end, content, content_hash, scope,
           source, source_type, related_entity_id, token_count, trust_class,
           injection_flags_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'web', ?, ?, ?, ?, ?, ?)`,
      );
      chunkRows = [];
      for (let index = 0; index < target.chunks.length; index += 1) {
        const chunk = target.chunks[index];
        const result = insertChunk.run(
          `source-memory/${row.id}.md`,
          chunk.lineStart,
          chunk.lineEnd,
          chunk.content,
          contentHash(`${row.id}:${index}:${chunk.content}`),
          normalizeScope(row.scope),
          `source-memory:${row.id}`,
          messageId,
          chunk.tokenCount,
          trustClass,
          injectionFlagsJson,
          timestamp,
          timestamp,
        );
        const chunkId = Number(result.lastInsertRowid);
        chunkRows.push({ chunk_id: chunkId, related_entity_id: messageId });
        applied.newChunks += 1;
        applied.insertedChunkIds.push(chunkId);
      }
    }

    for (const chunk of chunkRows) {
      const result = insertMetadata.run(
        'chunk',
        String(chunk.chunk_id),
        chunkImportance,
        chunkImportance,
        timestamp,
        timestamp,
      );
      applied.chunkMetadataRows += result.changes;
    }

    // This path restores a brand-new raw row, so there is no prior claim set to
    // invalidate and force=true would only create needless stale revisions.
    new MemoryClaimAttributionService(this.db).ensureForMessage(messageId);
  }
}

function getCaptureModeMessageImportance(captureMode: string): number {
  if (captureMode === 'manual') return 0.72;
  if (captureMode === 'auto') return 0.58;
  return 0.64;
}

function normalizeScope(scope: string): 'personal' | 'work' {
  return scope === 'personal' ? 'personal' : 'work';
}

function parseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeRunId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(normalized)) {
    throw new Error('Run id must be 1-128 safe identifier characters.');
  }
  return normalized;
}
