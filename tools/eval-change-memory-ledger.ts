import fs from 'node:fs';

import type { ContextRecallRequest, MemoryChangeProjection } from '../memory-service/src/types/index.js';
import {
  MemoryChangeLedgerService,
  type MemoryChangeSourceInput,
} from '../memory-service/src/core/MemoryChangeLedgerService.js';
import { toChangeProjectionEvidence } from '../memory-service/src/core/ContextAssistService.js';
import { cleanupTestDb, getTestDb } from '../memory-service/src/__tests__/setup.js';

interface LedgerEvalCase {
  id: string;
  title: string;
  sampleContext: { sources: MemoryChangeSourceInput[] };
  query: {
    mode: 'source' | 'context' | 'ask';
    sourceRefType?: string;
    sourceRefId?: string;
    request?: ContextRecallRequest;
    text?: string;
  };
  expectedBehavior: {
    receiptStatus?: string;
    extractedCount?: number;
    excludedNoiseCount?: number;
    projectionCount?: number;
    propertyKeys?: string[];
    subjectKeys?: string[];
    mustNotContainSubjectKeys?: string[];
    statuses?: string[];
    currentNormalized?: unknown;
    visibleNormalized?: unknown;
    reversalCount?: number;
    conflictCount?: number;
    historyCount?: number;
    promptMustContain?: string[];
    promptMustNotContain?: string[];
    composeMustContain?: string[];
    composeMustNotContain?: string[];
  };
}

const casePath = process.argv[2];
if (!casePath) throw new Error('Usage: eval-change-memory-ledger.ts <case-json-path>');

const caseItem = JSON.parse(fs.readFileSync(casePath, 'utf8')) as LedgerEvalCase;
const db = getTestDb();

try {
  resetDb();
  const service = new MemoryChangeLedgerService(db);
  const receipts = caseItem.sampleContext.sources.map((source) => service.syncSource(source));
  const receipt = caseItem.query.mode === 'source'
    ? service.getSourceLedger(
        caseItem.query.sourceRefType || 'source_memory',
        caseItem.query.sourceRefId || '',
      )
    : receipts.at(-1);
  const projections = resolveProjections(service, caseItem, receipt?.projections ?? []);
  const prompt = service.formatForPrompt(projections);
  const composeEvidence = projections.map(toChangeProjectionEvidence);
  const actualOutput = {
    receipt: receipt
      ? {
          status: receipt.status,
          extractedCount: receipt.extractedCount,
          excludedNoiseCount: receipt.excludedNoiseCount,
          label: receipt.label,
          detail: receipt.detail,
        }
      : null,
    projections: projections.map(summarizeProjection),
    prompt,
    composeEvidence: composeEvidence.map((item) => ({
      id: item.id,
      title: item.title,
      snippet: item.snippet,
      boundary: item.metadata?.currentStateBoundary,
    })),
  };
  const failures = judge(caseItem, receipt, projections, prompt, composeEvidence.map((item) => item.snippet).join('\n'));
  const status = failures.length ? 'fail' : 'pass';
  const scores = {
    extraction_accuracy: failures.some((item) => /receipt|extracted|noise|property/i.test(item)) ? 0 : 3,
    temporal_projection: failures.some((item) => /projection|status|current|visible|reversal|conflict|history|subject/i.test(item)) ? 0 : 3,
    trust_boundary: failures.some((item) => /prompt|compose|contain/i.test(item)) ? 0 : 3,
  };
  console.log(JSON.stringify({
    status,
    verdict: status,
    scores,
    overallScore: status === 'pass' ? 100 : Math.round(Object.values(scores).reduce((sum, value) => sum + value, 0) / 9 * 49),
    why: failures[0] || '变化事件、时间投影和使用边界均符合预期。',
    userConclusion: status === 'pass'
      ? '通过：变化脉络保留了对象隔离、时间顺序和当前状态边界。'
      : '不通过：变化脉络在提取、投影或 Ask/Compose 边界上存在偏差。',
    improvementSuggestions: failures.length ? failures : ['继续把真实 Goal、release 和 Jira 变更样本加入此 suite。'],
    actualOutput,
  }));
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM memory_change_events').run();
  db.prepare('DELETE FROM memory_change_chains').run();
  db.prepare('DELETE FROM memory_change_extractions').run();
}

function resolveProjections(
  service: MemoryChangeLedgerService,
  caseItem: LedgerEvalCase,
  sourceProjections: MemoryChangeProjection[],
): MemoryChangeProjection[] {
  if (caseItem.query.mode === 'context') {
    if (!caseItem.query.request) throw new Error('context query requires request');
    return service.getContextProjections(caseItem.query.request);
  }
  if (caseItem.query.mode === 'ask') {
    return service.findForAsk(caseItem.query.text || '');
  }
  return sourceProjections;
}

function summarizeProjection(projection: MemoryChangeProjection) {
  return {
    chainKey: projection.chainKey,
    subjectKey: projection.subjectKey,
    propertyKey: projection.propertyKey,
    status: projection.status,
    currentNormalized: projection.currentValue?.normalized,
    visibleNormalized: projection.visiblePageValue?.normalized,
    reversalCount: projection.reversalCount,
    conflictCount: projection.conflictCount,
    historyCount: projection.history.length,
    boundary: projection.boundary,
  };
}

function judge(
  caseItem: LedgerEvalCase,
  receipt: ReturnType<MemoryChangeLedgerService['getSourceLedger']> | undefined,
  projections: MemoryChangeProjection[],
  prompt: string,
  composeText: string,
): string[] {
  const expected = caseItem.expectedBehavior;
  const failures: string[] = [];
  checkEqual(failures, 'receiptStatus', receipt?.status, expected.receiptStatus);
  checkEqual(failures, 'extractedCount', receipt?.extractedCount, expected.extractedCount);
  checkEqual(failures, 'excludedNoiseCount', receipt?.excludedNoiseCount, expected.excludedNoiseCount);
  checkEqual(failures, 'projectionCount', projections.length, expected.projectionCount);
  checkArray(failures, 'propertyKeys', projections.map((item) => item.propertyKey), expected.propertyKeys);
  checkArray(failures, 'subjectKeys', projections.map((item) => item.subjectKey), expected.subjectKeys);
  checkArray(failures, 'statuses', projections.map((item) => item.status), expected.statuses);
  checkEqual(failures, 'currentNormalized', projections[0]?.currentValue?.normalized, expected.currentNormalized);
  checkEqual(failures, 'visibleNormalized', projections[0]?.visiblePageValue?.normalized, expected.visibleNormalized);
  checkEqual(failures, 'reversalCount', projections[0]?.reversalCount, expected.reversalCount);
  checkEqual(failures, 'conflictCount', projections[0]?.conflictCount, expected.conflictCount);
  checkEqual(failures, 'historyCount', projections[0]?.history.length, expected.historyCount);
  for (const subjectKey of expected.mustNotContainSubjectKeys ?? []) {
    if (projections.some((item) => item.subjectKey === subjectKey)) failures.push(`must not contain subject ${subjectKey}`);
  }
  checkContains(failures, 'prompt', prompt, expected.promptMustContain, expected.promptMustNotContain);
  checkContains(failures, 'compose', composeText, expected.composeMustContain, expected.composeMustNotContain);
  return failures;
}

function checkEqual(failures: string[], label: string, actual: unknown, expected: unknown): void {
  if (expected === undefined) return;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function checkArray(failures: string[], label: string, actual: string[], expected?: string[]): void {
  if (!expected) return;
  const normalizedActual = [...actual].sort();
  const normalizedExpected = [...expected].sort();
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    failures.push(`${label}: expected ${normalizedExpected.join(', ')}, got ${normalizedActual.join(', ')}`);
  }
}

function checkContains(
  failures: string[],
  label: string,
  actual: string,
  required: string[] = [],
  forbidden: string[] = [],
): void {
  for (const value of required) {
    if (!actual.includes(value)) failures.push(`${label} must contain ${JSON.stringify(value)}`);
  }
  for (const value of forbidden) {
    if (actual.includes(value)) failures.push(`${label} must not contain ${JSON.stringify(value)}`);
  }
}
