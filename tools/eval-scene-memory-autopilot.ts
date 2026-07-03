import fs from 'node:fs';

import { ContextRecallService } from '../memory-service/src/core/ContextRecallService.js';
import { EmbeddingClient } from '../memory-service/src/llm/EmbeddingClient.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';
import type {
  ContextRecallRequest,
  SourceType,
} from '../memory-service/src/types/index.js';

interface EvalMemory {
  id: string;
  chunkId: number;
  content: string;
  scope?: 'work' | 'personal';
  sourceType?: SourceType;
  sourceUrl?: string;
  sourceTitle?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  relatedProject?: string | null;
  metadata?: Record<string, unknown>;
}

interface SourceProvenance {
  source?: string;
  status?: string;
  note?: string;
}

interface SourceProvenanceAudit {
  total: number;
  byStatus: Record<string, number>;
  trustedInputCount: number;
  blockedCount: number;
  staleCount: number;
  unverifiedCount: number;
  unknownCount: number;
  summary: string;
  warnings: string[];
}

interface SceneAutopilotCase {
  id: string;
  title: string;
  kind: string;
  expectedBehavior?: {
    topMatchId?: string;
    mustIncludeIds?: string[];
    mustIncludeAnyIds?: string[];
    mustSuppressIds?: string[];
    expectedMode?: string;
    requiredQuietReasons?: string[];
    minQuietedCount?: number;
    minDuplicateMergedCount?: number;
    requireWhyRelevantForP1?: boolean;
  };
  sampleContext?: {
    memories?: EvalMemory[];
    sourceProvenance?: SourceProvenance[];
  };
  request: ContextRecallRequest;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-scene-memory-autopilot.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as SceneAutopilotCase;
const db = getTestDb();
const currentTime = Math.floor(Date.now() / 1000);

// Keep this eval deterministic and fast. FTS remains active; vector recall is
// intentionally skipped exactly like the unit harness.
process.env.CONTEXT_RECALL_PASSIVE_FAST_MODE = 'true';
process.env.CONTEXT_RECALL_PASSIVE_SEARCH_ENABLED = 'true';
process.env.CONTEXT_RECALL_PASSIVE_VECTOR_ENABLED = 'false';
(EmbeddingClient as unknown as {
  getInstance: () => Promise<EmbeddingClient>;
}).getInstance = async () => {
  throw new Error('Embedding disabled for scene-memory-autopilot eval');
};

try {
  resetDb();
  for (const memory of caseItem.sampleContext?.memories ?? []) {
    insertMemory(memory);
  }

  const service = new ContextRecallService(db);
  const response = await service.recall({ ...caseItem.request, debug: true });
  const sourceProvenanceAudit = auditSourceProvenance(caseItem);
  const heuristic = judgeResponse(caseItem, response, sourceProvenanceAudit);
  const status = heuristic.failures.length
    ? 'fail'
    : heuristic.warnings.length
      ? 'warn'
      : 'pass';
  const scores = buildScores(heuristic, sourceProvenanceAudit);
  const overallScore =
    status === 'fail' ? Math.min(scoreAverage(scores), 49) : scoreAverage(scores);

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore,
      why:
        heuristic.failures[0] ||
        heuristic.warnings[0] ||
        'Scene Memory Autopilot behaved as expected.',
      userConclusion:
        status === 'fail'
          ? '不通过：场景记忆自动驾驶没有按预期展示或静默候选。'
          : status === 'warn'
            ? '需关注：主行为通过，但诊断字段还不完整。'
            : '通过：弱关联、低信息或重复候选被静默，强展示结果带有场景解释。',
      improvementSuggestions: heuristic.failures.length
        ? heuristic.failures
        : heuristic.warnings.length
          ? heuristic.warnings
          : ['把真实误召回样本继续加入 context-recall 和 scene-memory-autopilot suites。'],
      actualOutput: {
        ...summarizeResponse(response),
        sourceProvenanceAudit,
      },
      topMatch: summarizeMatch(response.topMatch),
      autopilot: response.autopilot,
      sourceProvenanceAudit,
    }),
  );
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM conversation_context_frames').run();
  db.prepare('DELETE FROM memory_feedback_events').run();
  db.prepare('DELETE FROM memory_metadata').run();
  db.prepare('DELETE FROM messages_raw').run();
  db.prepare('DELETE FROM chunks').run();
  db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
}

function insertMemory(memory: EvalMemory): void {
  const timestamp = currentTime - 60;
  const sourceType = memory.sourceType ?? 'glip';
  const metadata = memory.metadata ?? {};
  db.prepare(
    `INSERT INTO messages_raw
      (id, content, scope, source_type, source_url, source_title, sender,
       group_id, group_name, timestamp, importance, sentiment, metadata_json,
       created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.8, 'neutral', ?, ?)`,
  ).run(
    memory.id,
    memory.content,
    memory.scope ?? 'work',
    sourceType,
    memory.sourceUrl ?? `https://app.ringcentral.com/messages/${memory.id}`,
    memory.sourceTitle ?? memory.groupName ?? 'RingCentral 消息',
    memory.sender ?? 'eval',
    memory.groupId ?? 'scene-eval',
    memory.groupName ?? 'Scene Eval',
    timestamp,
    JSON.stringify(metadata),
    timestamp,
  );

  db.prepare(
    `INSERT INTO chunks
      (chunk_id, file_path, line_start, line_end, content, content_hash, scope,
       source, source_type, related_project, created_at)
     VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    memory.chunkId,
    `messages/${memory.id}`,
    memory.content,
    `hash-${memory.id}`,
    memory.scope ?? 'work',
    sourceType,
    sourceType,
    memory.relatedProject ?? null,
    timestamp,
  );

  db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
    memory.chunkId,
    [
      memory.content,
      typeof metadata.summary === 'string' ? metadata.summary : '',
      JSON.stringify(metadata.contextMessages || []),
      JSON.stringify(metadata.entities || {}),
      JSON.stringify(metadata.metadata || {}),
    ].join(' '),
  );
}

function judgeResponse(
  caseItem: SceneAutopilotCase,
  response: Awaited<ReturnType<ContextRecallService['recall']>>,
  sourceProvenanceAudit: SourceProvenanceAudit,
) {
  const expected = caseItem.expectedBehavior ?? {};
  const visibleReturnedIds = response.matches
    .filter((match) => match.displayPriority !== 'hidden')
    .map((match) => match.id);
  const quietReasons = new Set(
    (response.autopilot?.quietReasons || []).map((item) => item.reason),
  );
  const failures: string[] = [];
  const warnings: string[] = [];

  if (expected.topMatchId && response.topMatch?.id !== expected.topMatchId) {
    failures.push(
      `expected topMatch=${expected.topMatchId}, got ${response.topMatch?.id ?? 'none'}.`,
    );
  }
  for (const id of expected.mustIncludeIds ?? []) {
    if (!visibleReturnedIds.includes(id)) failures.push(`expected ${id} to be shown.`);
  }
  if (
    expected.mustIncludeAnyIds?.length &&
    !expected.mustIncludeAnyIds.some((id) => visibleReturnedIds.includes(id))
  ) {
    failures.push(
      `expected one of ${expected.mustIncludeAnyIds.join(', ')} to be shown.`,
    );
  }
  for (const id of expected.mustSuppressIds ?? []) {
    if (visibleReturnedIds.includes(id)) failures.push(`expected ${id} to be quieted.`);
  }
  if (expected.expectedMode && response.autopilot?.mode !== expected.expectedMode) {
    failures.push(
      `expected autopilot mode=${expected.expectedMode}, got ${response.autopilot?.mode ?? 'none'}.`,
    );
  }
  for (const reason of expected.requiredQuietReasons ?? []) {
    if (!quietReasons.has(reason)) {
      failures.push(`expected quiet reason ${reason}.`);
    }
  }
  if (
    Number(response.autopilot?.quietedCount ?? 0) <
    Number(expected.minQuietedCount ?? 0)
  ) {
    failures.push(
      `expected quietedCount >= ${expected.minQuietedCount}, got ${response.autopilot?.quietedCount ?? 0}.`,
    );
  }
  if (
    Number(response.autopilot?.duplicateMergedCount ?? 0) <
    Number(expected.minDuplicateMergedCount ?? 0)
  ) {
    failures.push(
      `expected duplicateMergedCount >= ${expected.minDuplicateMergedCount}, got ${response.autopilot?.duplicateMergedCount ?? 0}.`,
    );
  }
  if (
    expected.requireWhyRelevantForP1 &&
    response.matches.some(
      (match) =>
        match.displayPriority === 'p1' &&
        (!Array.isArray(match.whyRelevant) || match.whyRelevant.length === 0),
    )
  ) {
    failures.push('p1 matches must include whyRelevant anchors.');
  }
  if (!response.autopilot) {
    warnings.push('response did not include autopilot diagnostics.');
  }
  warnings.push(...sourceProvenanceAudit.warnings);

  return { failures, warnings };
}

function buildScores(heuristic: {
  failures: string[];
  warnings: string[];
}, sourceProvenanceAudit: SourceProvenanceAudit): Record<string, number> {
  const failed = heuristic.failures.length > 0;
  return {
    scene_filtering: failed ? 0 : 3,
    quiet_reasoning: failed ? 0 : heuristic.warnings.length ? 2 : 3,
    deduplication: failed ? 0 : 3,
    explainability: failed ? 0 : 3,
    source_provenance: failed ? 0 : sourceProvenanceAudit.warnings.length ? 2 : 3,
  };
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / (values.length * 3)) *
      100,
  );
}

function summarizeResponse(
  response: Awaited<ReturnType<ContextRecallService['recall']>>,
) {
  return {
    matches: response.matches.map(summarizeMatch),
    topMatch: summarizeMatch(response.topMatch),
    autopilot: response.autopilot,
    debug: response.debug,
  };
}

function auditSourceProvenance(caseItem: SceneAutopilotCase): SourceProvenanceAudit {
  const entries = caseItem.sampleContext?.sourceProvenance ?? [];
  const byStatus: Record<string, number> = {};
  let trustedInputCount = 0;
  let blockedCount = 0;
  let staleCount = 0;
  let unverifiedCount = 0;
  let unknownCount = 0;

  for (const entry of entries) {
    const status = normalizeProvenanceStatus(entry.status);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (isTrustedInputStatus(status)) trustedInputCount += 1;
    if (isBlockedStatus(status)) blockedCount += 1;
    if (isStaleStatus(status)) staleCount += 1;
    if (isUnverifiedStatus(status)) unverifiedCount += 1;
    if (status === 'unknown') unknownCount += 1;
  }

  const warnings: string[] = [];
  if (!entries.length) {
    warnings.push('sourceProvenance is missing; report cannot prove where the sample came from.');
  } else if (trustedInputCount === 0) {
    warnings.push('sourceProvenance has no used, verified, synthetic, or fixture input source.');
  }
  if (staleCount > 0) {
    warnings.push(`sourceProvenance includes ${staleCount} stale source(s); refresh or label the case as historical.`);
  }
  if (unverifiedCount + unknownCount > 0) {
    warnings.push(
      `sourceProvenance includes ${unverifiedCount + unknownCount} unverified or unknown source(s).`,
    );
  }

  const summary = [
    `${trustedInputCount} trusted input`,
    `${blockedCount} blocked`,
    `${staleCount} stale`,
    `${unverifiedCount + unknownCount} unverified/unknown`,
  ].join(', ');

  return {
    total: entries.length,
    byStatus,
    trustedInputCount,
    blockedCount,
    staleCount,
    unverifiedCount,
    unknownCount,
    summary,
    warnings,
  };
}

function normalizeProvenanceStatus(status: unknown): string {
  if (typeof status !== 'string' || !status.trim()) return 'unknown';
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isTrustedInputStatus(status: string): boolean {
  return [
    'used',
    'verified',
    'synthetic',
    'fixture',
    'live_snapshot',
    'private_live_data_snapshot',
    'synthetic_redacted',
  ].includes(status);
}

function isBlockedStatus(status: string): boolean {
  return ['blocked', 'unavailable', 'failed', 'skipped', 'inaccessible', 'denied'].includes(status);
}

function isStaleStatus(status: string): boolean {
  return ['stale', 'outdated'].includes(status);
}

function isUnverifiedStatus(status: string): boolean {
  return ['unverified', 'unclear', 'manual_note'].includes(status);
}

function summarizeMatch(match: unknown) {
  if (!match || typeof match !== 'object') return null;
  const item = match as Record<string, unknown>;
  return {
    id: item.id,
    title: item.title,
    sourceLabel: item.sourceLabel,
    displayPriority: item.displayPriority,
    whyRelevant: item.whyRelevant,
    matchedAnchors: item.matchedAnchors,
    suppressionReason: item.suppressionReason,
    mergedCount: item.mergedCount,
  };
}
