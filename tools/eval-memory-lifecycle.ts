import fs from 'node:fs';

import { ForgettingEngine } from '../memory-service/src/core/ForgettingEngine.js';
import { RecallEngine } from '../memory-service/src/core/RecallEngine.js';
import { cleanupTestDb, getTestDb } from '../memory-service/src/__tests__/setup.js';
import type { RecallLifecycleMode } from '../memory-service/src/types/index.js';

interface EvalMemory {
  id: string;
  content: string;
  ageDays?: number;
  salienceScore?: number;
  retrievalTier?: string | null;
  consolidationLevel?: string;
  feedbackAction?: 'positive' | 'negative' | 'clear';
  decayRate?: number;
  halfLifeDays?: number;
  lastAccessedAgeDays?: number;
}

interface RecallExpectation {
  label: string;
  lifecycleMode: RecallLifecycleMode;
  query: string;
  mustInclude?: string[];
  mustExclude?: string[];
  expectedTiers?: Record<string, string>;
}

interface LifecycleCase {
  id: string;
  title: string;
  kind: string;
  sampleContext?: {
    memories?: EvalMemory[];
  };
  expectedBehavior?: {
    recallChecks?: RecallExpectation[];
    forgetting?: {
      expectedTiers?: Record<string, string>;
      expectedConsolidationLevels?: Record<string, string>;
    };
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-memory-lifecycle.ts <case-json-path>');
}

const caseItem = JSON.parse(fs.readFileSync(casePath, 'utf8')) as LifecycleCase;
const db = getTestDb();
const currentTime = Math.floor(Date.now() / 1000);

try {
  resetDb();
  for (const memory of caseItem.sampleContext?.memories ?? []) {
    insertMemory(memory);
  }

  const recallChecks = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const check of caseItem.expectedBehavior?.recallChecks ?? []) {
    const result = await runRecallCheck(check);
    recallChecks.push(result);
    failures.push(...result.failures);
    warnings.push(...result.warnings);
  }

  let forgettingResult: unknown = null;
  let forgettingRows: Array<{
    id: string;
    consolidationLevel: string;
    retrievalTier: string;
    effectiveSalience: number;
  }> = [];

  if (caseItem.expectedBehavior?.forgetting) {
    const engine = new ForgettingEngine(db);
    forgettingResult = await engine.runForgettingCycle();
    forgettingRows = loadMemoryRows();
    judgeForgettingRows({
      rows: forgettingRows,
      expectation: caseItem.expectedBehavior.forgetting,
      failures,
    });
  }

  const scores = buildScores({ recallChecks, forgettingRows, failures });
  const verdict = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';
  const overallScore = verdict === 'fail'
    ? Math.min(scoreAverage(scores), 49)
    : scoreAverage(scores);

  const output = {
    status: verdict,
    verdict,
    scores,
    overallScore,
    why: failures[0] || warnings[0] || 'Lifecycle policy behaved as expected.',
    userConclusion: failures.length
      ? '不通过：生命周期策略没有按预期过滤、降权或归档记忆。'
      : warnings.length
        ? '需关注：主路径通过，但有诊断字段不完整。'
        : '通过：默认/被动/写作召回不会关联归档或负反馈记忆，历史/显式查询可降级查看。',
    improvementSuggestions: failures.length
      ? failures
      : warnings.length
        ? warnings
        : ['继续把真实误召回样本加入这个 suite，尤其是 Context Recall、Ask 和 Compose Assist 的边界样本。'],
    actualOutput: {
      recallChecks: recallChecks.map((item) => ({
        label: item.label,
        lifecycleMode: item.lifecycleMode,
        returnedIds: item.returnedIds,
        returnedTiers: item.returnedTiers,
      })),
      forgettingResult,
      forgettingRows,
    },
    topMatch: recallChecks[0]?.items[0]
      ? {
          id: recallChecks[0].items[0].id,
          title: recallChecks[0].items[0].sourceTitle || recallChecks[0].items[0].id,
          sourceLabel: recallChecks[0].items[0].source || recallChecks[0].items[0].type,
          displayPriority: recallChecks[0].items[0].metadata?.retrievalTier || 'unknown',
          whyRelevant: [
            `tier=${recallChecks[0].items[0].metadata?.retrievalTier ?? '-'}`,
            `mode=${recallChecks[0].lifecycleMode}`,
          ],
        }
      : null,
  };

  console.log(JSON.stringify(output));
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM memory_feedback_events').run();
  db.prepare('DELETE FROM memory_metadata').run();
  db.prepare('DELETE FROM messages_raw').run();
}

function insertMemory(memory: EvalMemory): void {
  const timestamp = currentTime - Math.max(0, memory.ageDays ?? 0) * 86400;
  db.prepare(
    `INSERT INTO messages_raw
      (id, content, scope, source_type, sender, group_id, group_name, timestamp,
       importance, sentiment, metadata_json, created_at)
     VALUES (?, ?, 'work', 'manual', 'eval', 'memory-lifecycle',
       'Memory Lifecycle Eval', ?, 0.8, 'neutral', '{}', ?)`,
  ).run(memory.id, memory.content, timestamp, timestamp);

  if (memory.retrievalTier !== null) {
    const lastAccessed =
      currentTime - Math.max(0, memory.lastAccessedAgeDays ?? memory.ageDays ?? 0) * 86400;
    db.prepare(
      `INSERT INTO memory_metadata
        (target_type, target_id, salience_score, effective_salience,
         retrieval_tier, consolidation_level, access_count, last_accessed,
         decay_rate, half_life_days, created_at, updated_at)
       VALUES ('message', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    ).run(
      memory.id,
      memory.salienceScore ?? 0.5,
      memory.salienceScore ?? 0.5,
      memory.retrievalTier ?? 'active',
      memory.consolidationLevel ?? 'working',
      lastAccessed,
      memory.decayRate ?? 1,
      memory.halfLifeDays ?? 30,
      timestamp,
      currentTime,
    );
  }

  if (memory.feedbackAction) {
    db.prepare(
      `INSERT INTO memory_feedback_events
        (feedback_type, target_type, target_id, action, created_at, updated_at)
       VALUES ('recall_quality', 'message', ?, ?, ?, ?)`,
    ).run(memory.id, memory.feedbackAction, currentTime, currentTime);
  }
}

async function runRecallCheck(check: RecallExpectation) {
  const engine = new RecallEngine(db);
  const result = await engine.recall(
    {
      query: check.query,
      channels: ['time'],
      timeRange: {
        start: currentTime - 800 * 86400,
        end: currentTime + 60,
      },
      topK: 20,
      includeMetadata: true,
      lifecycleMode: check.lifecycleMode,
      scope: 'work',
    },
    { reinforceAccess: false },
  );

  const returnedIds = result.items.map((item) => item.id);
  const returnedTiers = Object.fromEntries(
    result.items.map((item) => [
      item.id,
      String(item.metadata?.retrievalTier ?? 'unknown'),
    ]),
  );
  const failures: string[] = [];
  const warnings: string[] = [];

  for (const id of check.mustInclude ?? []) {
    if (!returnedIds.includes(id)) {
      failures.push(`${check.label}: expected ${id} to be returned.`);
    }
  }
  for (const id of check.mustExclude ?? []) {
    if (returnedIds.includes(id)) {
      failures.push(`${check.label}: expected ${id} to be suppressed.`);
    }
  }
  for (const [id, expectedTier] of Object.entries(check.expectedTiers ?? {})) {
    if (returnedTiers[id] !== expectedTier) {
      failures.push(
        `${check.label}: expected ${id} tier=${expectedTier}, got ${returnedTiers[id] ?? 'missing'}.`,
      );
    }
  }
  if (result.items.some((item) => item.metadata?.lifecycleReason == null)) {
    warnings.push(`${check.label}: some returned items lack lifecycleReason metadata.`);
  }

  return {
    label: check.label,
    lifecycleMode: check.lifecycleMode,
    returnedIds,
    returnedTiers,
    items: result.items,
    failures,
    warnings,
  };
}

function loadMemoryRows() {
  return db
    .prepare(
      `SELECT target_id AS id, consolidation_level AS consolidationLevel,
              retrieval_tier AS retrievalTier, effective_salience AS effectiveSalience
       FROM memory_metadata
       ORDER BY target_id`,
    )
    .all() as Array<{
      id: string;
      consolidationLevel: string;
      retrievalTier: string;
      effectiveSalience: number;
    }>;
}

function judgeForgettingRows({
  rows,
  expectation,
  failures,
}: {
  rows: ReturnType<typeof loadMemoryRows>;
  expectation: NonNullable<LifecycleCase['expectedBehavior']>['forgetting'];
  failures: string[];
}): void {
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const [id, tier] of Object.entries(expectation?.expectedTiers ?? {})) {
    if (byId.get(id)?.retrievalTier !== tier) {
      failures.push(
        `forgetting: expected ${id} retrievalTier=${tier}, got ${byId.get(id)?.retrievalTier ?? 'missing'}.`,
      );
    }
  }
  for (const [id, level] of Object.entries(expectation?.expectedConsolidationLevels ?? {})) {
    if (byId.get(id)?.consolidationLevel !== level) {
      failures.push(
        `forgetting: expected ${id} consolidationLevel=${level}, got ${byId.get(id)?.consolidationLevel ?? 'missing'}.`,
      );
    }
  }
}

function buildScores({
  recallChecks,
  forgettingRows,
  failures,
}: {
  recallChecks: Array<{ failures: string[] }>;
  forgettingRows: Array<unknown>;
  failures: string[];
}) {
  const recallFailures = recallChecks.flatMap((item) => item.failures);
  return {
    lifecycle_filtering: recallFailures.length ? 0 : 3,
    historical_access: recallFailures.length ? 0 : 3,
    archive_writeback: forgettingRows.length ? (failures.some((item) => item.startsWith('forgetting:')) ? 0 : 3) : 3,
    reportability: 3,
  };
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / (values.length * 3)) * 100);
}
