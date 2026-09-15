import type Database from 'better-sqlite3';

import type { RecallItem } from '../types/index.js';

/**
 * Compact surfaces (meeting danmaku, live feed chips) can only show a single
 * sentence. Ingestion already asks the LLM for a `summary` and stores it on
 * `messages_raw.summary`, but recall only ever read `content`, so those surfaces
 * were forced to show a truncated content prefix instead of the compressed
 * gist.
 *
 * Design decision: the canonical gist belongs to *storage* time (one stable
 * sentence per memory, reusable by every surface), while *scene framing* — which
 * relation label, why it matters now — belongs to recall time. This service
 * fills the storage -> recall gap by reading the stored gist and exposing it as
 * `oneLineSummary` without changing the existing `uiSummary` contract.
 */

export const ONE_LINE_SUMMARY_MAX = 180;

interface StoredSummaryRow {
  id: string;
  summary: string | null;
}

interface ChunkRefRow {
  chunk_id: number;
  file_path: string | null;
  related_entity_id: string | null;
}

function normalizeOneLineSummary(value?: string | null): string {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[-*•\s]+/, '')
    .trim();
}

/** Normalize and clip a candidate gist so it stays displayable in one line. */
export function clipOneLineSummary(
  value?: string | null,
  maxLength: number = ONE_LINE_SUMMARY_MAX,
): string | undefined {
  const normalized = normalizeOneLineSummary(value);
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function stripKnownChunkPathExtension(value: string): string {
  return value.replace(/\.(md|txt|json)$/i, '');
}

/** Mirrors RecallEngine's chunk -> source message resolution. */
export function collectChunkMessageRefCandidates(
  filePath?: string | null,
  relatedEntityId?: string | null,
): string[] {
  const candidates = new Set<string>();
  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(relatedEntityId);
  const path = (filePath || '').trim();
  for (const prefix of ['messages/', 'calendar/']) {
    if (path.startsWith(prefix)) {
      add(stripKnownChunkPathExtension(path.slice(prefix.length)));
    }
  }
  return Array.from(candidates);
}

/**
 * Batch-read the ingestion-time LLM summaries for message ids.
 * Returns an empty map on failure so recall never fails because of an optional
 * presentation enrichment.
 */
export function loadStoredMessageSummaries(
  db: Database.Database,
  messageIds: string[],
): Map<string, string> {
  const ids = Array.from(new Set(messageIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const placeholders = ids.map(() => '?').join(', ');
  try {
    const rows = db
      .prepare(
        `SELECT id, summary FROM messages_raw WHERE id IN (${placeholders})`,
      )
      .all(...ids) as StoredSummaryRow[];
    const summaries = new Map<string, string>();
    for (const row of rows) {
      const summary = clipOneLineSummary(row.summary);
      if (summary) summaries.set(row.id, summary);
    }
    return summaries;
  } catch (error) {
    console.warn(
      '[ContextOneLineSummary] failed to load stored message summaries:',
      error,
    );
    return new Map();
  }
}

function loadChunkRefs(
  db: Database.Database,
  chunkIds: string[],
): ChunkRefRow[] {
  const numericIds = chunkIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (numericIds.length === 0) return [];
  const placeholders = numericIds.map(() => '?').join(', ');
  try {
    return db
      .prepare(
        `SELECT chunk_id, file_path, related_entity_id
         FROM chunks
         WHERE chunk_id IN (${placeholders})`,
      )
      .all(...numericIds) as ChunkRefRow[];
  } catch (error) {
    console.warn(
      '[ContextOneLineSummary] failed to load chunk source refs:',
      error,
    );
    return [];
  }
}

/**
 * Attach the stored extraction summary to recall items that do not already
 * carry a metadata summary.
 *
 * Message items read `messages_raw.summary` directly; chunk items resolve their
 * source message through the same paths RecallEngine uses so meeting recall
 * (which mostly returns chunks) also gets a compressed gist.
 */
export function attachStoredMessageSummaries(
  db: Database.Database,
  items: RecallItem[],
): RecallItem[] {
  const messageIds = items
    .filter((item) => item.type === 'message')
    .map((item) => item.id);
  const chunkIds = items
    .filter((item) => item.type === 'chunk')
    .map((item) => item.id);
  if (messageIds.length === 0 && chunkIds.length === 0) return items;

  const summariesById = loadStoredMessageSummaries(db, messageIds);

  const chunkSummaryByChunkId = new Map<string, string>();
  if (chunkIds.length > 0) {
    const chunkRefs = loadChunkRefs(db, chunkIds);
    const candidateIds = chunkRefs.flatMap((row) =>
      collectChunkMessageRefCandidates(row.file_path, row.related_entity_id),
    );
    const chunkMessageSummaries = loadStoredMessageSummaries(db, candidateIds);
    for (const row of chunkRefs) {
      const candidates = collectChunkMessageRefCandidates(
        row.file_path,
        row.related_entity_id,
      );
      for (const candidate of candidates) {
        const summary = chunkMessageSummaries.get(candidate);
        if (summary) {
          chunkSummaryByChunkId.set(String(row.chunk_id), summary);
          break;
        }
      }
    }
  }

  if (summariesById.size === 0 && chunkSummaryByChunkId.size === 0) {
    return items;
  }

  return items.map((item) => {
    const storedExtractionSummary =
      summariesById.get(item.id) || chunkSummaryByChunkId.get(item.id);
    if (!storedExtractionSummary) return item;
    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        storedExtractionSummary,
      },
    };
  });
}

/**
 * Resolve the canonical one-line gist for a recall item.
 *
 * Priority:
 * 1. an explicit `oneLineSummary` already attached upstream
 * 2. source-memory deep distillation cue (already a one-line sentence)
 * 3. message analysis summary stored in metadata
 * 4. ingestion-time extraction summary read from `messages_raw.summary`
 *
 * Items without any gist keep `undefined` so surfaces fall back to their own
 * extractive preview instead of inventing one here.
 */
export function resolveItemOneLineSummary(
  item: RecallItem,
): string | undefined {
  const metadata = item.metadata ?? {};
  return (
    clipOneLineSummary(metadata.oneLineSummary) ||
    clipOneLineSummary(metadata.sourceMemoryCue) ||
    clipOneLineSummary(
      typeof metadata.summary === 'string' ? metadata.summary : undefined,
    ) ||
    clipOneLineSummary(metadata.storedExtractionSummary)
  );
}
