import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import { AnswerMemoryService } from '../core/AnswerMemoryService.js';
import { AnswerMemoryRepository } from '../repositories/AnswerMemoryRepository.js';
import type { MemoryContextMatchResult } from '../core/MemoryContextMatchService.js';
import type { RecallItem } from '../types/index.js';
import { cleanupTestDb, getTestDb } from './setup.js';

const lockedVbgContext: MemoryContextMatchResult = {
  state: 'locked',
  selectedTopic: {
    id: 'project-ai-custom-vbg',
    label: 'AI Custom VBG',
    score: 0.9,
    confidence: 0.88,
    reasons: ['matched context frame'],
    anchors: ['MTR-141852'],
    roleTerms: ['backend'],
    aliases: ['AI VBG'],
    sourceIds: ['mtr-141852'],
    evidenceIds: ['ask-vbg-backend'],
  },
  candidates: [],
  expandedQuery: 'AI Custom VBG backend ready status',
  userFacingSummary: 'Locked to AI Custom VBG.',
};

const recalledItem: RecallItem = {
  id: 'ask-vbg-backend',
  type: 'message',
  content:
    'AI Custom VBG backend is not ready yet because RCV BE new design is still pending.',
  score: 0.94,
  source: 'glip',
  sourceTitle: 'MTR-141852: AI Custom VBG',
  timestamp: 1_799_000_000,
};

function resetAnswerMemoryTables(db: BetterSqlite3.Database): void {
  db.prepare('DELETE FROM answer_memory_versions').run();
  db.prepare('DELETE FROM answer_memory_threads').run();
  db.prepare('DELETE FROM answer_memory_observations').run();
}

describe('AnswerMemoryService', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = getTestDb();
    resetAnswerMemoryTables(db);
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('skips ambiguous or unlocked ask outcomes', () => {
    const service = new AnswerMemoryService(db);

    const ambiguous = service.observeAskOutcome({
      requestId: 'request-ambiguous',
      query: '那个 BE ready 了吗？',
      answer: '需要先确认你指的是哪个话题。',
      contextMatch: {
        ...lockedVbgContext,
        state: 'ambiguous',
        selectedTopic: undefined,
      },
      recalledItems: [recalledItem],
    });

    expect(ambiguous.state).toBe('skipped');
    expect(ambiguous.skipReason).toBe('context_ambiguous');
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM answer_memory_observations')
        .get(),
    ).toEqual({ count: 0 });
  });

  it('stores the first supported ask as an observation only', () => {
    const service = new AnswerMemoryService(db);

    const diagnostic = service.observeAskOutcome({
      requestId: 'request-1',
      query: '那个 BE ready 了吗？',
      answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      contextMatch: lockedVbgContext,
      recalledItems: [recalledItem],
      confidence: 0.76,
    });

    expect(diagnostic.state).toBe('observed');
    expect(diagnostic.canonicalKey).toContain('topic:project ai custom vbg');
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM answer_memory_observations')
        .get(),
    ).toEqual({ count: 1 });
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM answer_memory_threads').get(),
    ).toEqual({ count: 0 });
  });

  it('promotes the second canonical ask and returns a prior afterwards', () => {
    const service = new AnswerMemoryService(db);

    service.observeAskOutcome({
      requestId: 'request-1',
      query: '那个 BE ready 了吗？',
      answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      contextMatch: lockedVbgContext,
      recalledItems: [recalledItem],
      confidence: 0.76,
    });
    const promoted = service.observeAskOutcome({
      requestId: 'request-2',
      query: 'AI VBG 的 BE 部分完成情况如何？',
      answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      contextMatch: lockedVbgContext,
      recalledItems: [recalledItem],
      confidence: 0.77,
    });

    expect(promoted.state).toBe('promoted');
    expect(promoted.threadId).toBeTruthy();

    const prior = service.findPrior({
      query: '那个 BE ready 了吗？',
      contextMatch: lockedVbgContext,
    });
    expect(prior.diagnostic.state).toBe('priorHit');
    expect(prior.prior?.threadId).toBe(promoted.threadId);
    expect(prior.prior?.currentAnswer).toContain('还没有 ready');
  });

  it('creates a new version when the evidence changes for an existing thread', () => {
    const service = new AnswerMemoryService(db);
    const repo = new AnswerMemoryRepository(db);

    const first = service.observeAskOutcome({
      requestId: 'request-1',
      query: '那个 BE ready 了吗？',
      answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      contextMatch: lockedVbgContext,
      recalledItems: [recalledItem],
      confidence: 0.76,
    });
    expect(first.state).toBe('observed');
    const promoted = service.observeAskOutcome({
      requestId: 'request-2',
      query: 'AI VBG 的 BE 部分完成情况如何？',
      answer: 'AI Custom VBG 的 BE 还没有 ready，RCV BE new design 仍 pending。',
      contextMatch: lockedVbgContext,
      recalledItems: [recalledItem],
      confidence: 0.77,
    });
    expect(promoted.threadId).toBeTruthy();

    const updated = service.observeAskOutcome({
      requestId: 'request-3',
      query: '那个 BE ready 了吗？',
      answer: 'AI Custom VBG 的 BE 已经 ready，相关 backend blocker 已解除。',
      contextMatch: lockedVbgContext,
      recalledItems: [
        {
          ...recalledItem,
          id: 'ask-vbg-backend-ready',
          content: 'Backend blocker is resolved and AI Custom VBG BE is ready.',
          timestamp: recalledItem.timestamp! + 3600,
        },
      ],
      confidence: 0.82,
    });

    expect(updated.state).toBe('updated');
    expect(repo.countVersions(updated.threadId!)).toBe(2);
    const prior = service.findPrior({
      query: 'AI VBG backend ready status',
      contextMatch: lockedVbgContext,
    });
    expect(prior.prior?.currentAnswer).toContain('已经 ready');
  });
});
