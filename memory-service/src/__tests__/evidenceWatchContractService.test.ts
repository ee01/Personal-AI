import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type BetterSqlite3 from 'better-sqlite3';

import {
  EvidenceWatchContractService,
  type EvidenceWatchUiReceipt,
} from '../core/EvidenceWatchContractService.js';
import type { EvidenceResolutionPlan } from '../core/EvidenceResolutionPlanner.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { cleanupTestDb, getTestDb } from './setup.js';

function resetEvidenceWatchTables(db: BetterSqlite3.Database): void {
  db.prepare('DELETE FROM evidence_watch_links').run();
  db.prepare('DELETE FROM evidence_watch_runs').run();
  db.prepare('DELETE FROM evidence_watch_contracts').run();
  db.prepare('DELETE FROM proposed_action_attempts').run();
  db.prepare('DELETE FROM proposed_actions').run();
}

function buildWatchPlan(
  overrides: Partial<EvidenceResolutionPlan> = {},
): EvidenceResolutionPlan {
  return {
    resolutionState: 'insufficient',
    directFindings: [],
    remainingQuestions: ['需要继续观察 MTR-148115 的 DEV Estimate Original 是否变化。'],
    candidateArtifacts: [
      {
        kind: 'url',
        title: 'Jira MTR-148115',
        url: 'https://jira.example/browse/MTR-148115',
      },
    ],
    disposition: 'watch',
    reasonCode: 'future_monitoring',
    sourceAnchor: 'jira:MTR-148115:DEV Estimate Original',
    gapType: 'future_monitoring',
    recommendedAction: 'delegate_openclaw',
    actionParams: {
      mode: 'read',
      targetSystem: 'jira',
    },
    confidence: 0.68,
    legacyClassification: 'unclear',
    goalGaps: [],
    summary: '当前只有历史 estimate，需要守望权威字段变化。',
    ...overrides,
  };
}

describe('EvidenceWatchContractService', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = getTestDb();
    resetEvidenceWatchTables(db);
  });

  afterAll(() => {
    cleanupTestDb();
  });

  it('creates and reuses a contract for future-monitoring evidence plans', () => {
    const service = new EvidenceWatchContractService(db);
    const plan = buildWatchPlan();

    const first = service.createOrReuseFromPlan({
      plan,
      question: 'MTR-148115 的 DEV Estimate Original 现在还是 0.3 吗？',
      createdFrom: { kind: 'ask', refId: 'ask-1' },
      cadence: 'on_ask',
    });
    const second = service.createOrReuseFromPlan({
      plan,
      question: 'MTR-148115 的 DEV Estimate Original 有没有变化？',
      createdFrom: { kind: 'ask', refId: 'ask-2' },
      cadence: 'on_ask',
    });

    expect(first?.created).toBe(true);
    expect(second?.created).toBe(false);
    expect(second?.contract.id).toBe(first?.contract.id);
    expect(first?.contract.subjectKey).toContain('mtr-148115');
    expect(first?.contract.verifier).toMatchObject({
      kind: 'openclaw_read',
      actionType: 'delegate_openclaw',
      gapType: 'future_monitoring',
    });
    expect(service.getById(first!.contract.id)?.state).toBe('active');
    expect(service.listRuns(first!.contract.id)).toMatchObject([
      { runState: 'created' },
    ]);
  });

  it('records duplicate suppression without pretending a source was checked', () => {
    const service = new EvidenceWatchContractService(db);
    const actionRepo = new ActionRepository(db);
    const prep = service.prepareActionForPlan({
      plan: buildWatchPlan(),
      question: 'MTR-148115 estimate 是否变化？',
      createdFrom: { kind: 'reflection', refId: 'thread-1' },
      actionType: 'delegate_openclaw',
    });

    expect(prep?.idempotencyKey).toContain('evidence_watch:');
    const first = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '继续外部核实: MTR-148115',
      params: prep?.paramsPatch,
      executionMode: 'auto',
      requiresApproval: false,
      idempotencyKey: prep?.idempotencyKey,
      queueStatus: 'queued',
    });
    const reused = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '重复外部核实: MTR-148115',
      params: prep?.paramsPatch,
      executionMode: 'auto',
      requiresApproval: false,
      idempotencyKey: prep?.idempotencyKey,
      queueStatus: 'queued',
    });
    const duplicateReceipt = service.recordActionResult({
      contractId: prep!.contract.id,
      action: reused,
      wasDuplicate: first.id === reused.id,
    });
    const contractAfterDuplicate = service.getById(prep!.contract.id)!;

    expect(reused.id).toBe(first.id);
    expect(duplicateReceipt?.runState).toBe('skipped_duplicate');
    expect(contractAfterDuplicate.state).toBe('active');
    expect(contractAfterDuplicate.lastCheckedAt).toBeUndefined();
    const uiReceipt: EvidenceWatchUiReceipt = service.toUiReceipt(
      contractAfterDuplicate,
    );
    expect(uiReceipt.duplicateSuppressedCount).toBe(1);
    expect(uiReceipt.runId).toBe(duplicateReceipt?.id);
    expect(uiReceipt.lastRunState).toBe('skipped_duplicate');
    expect(uiReceipt.lastRunSummary).toContain('未创建重复外部查证');
    expect(uiReceipt.label).toBe('证据守望已建立');
    expect(uiReceipt.detail).toContain('不代表权威来源已完成复核');
    expect(uiReceipt.detail).toContain('已合并 1 次重复查证动作');
  });

  it('does not create contracts for ordinary decision plans', () => {
    const service = new EvidenceWatchContractService(db);
    const result = service.createOrReuseFromPlan({
      plan: buildWatchPlan({
        disposition: 'decision',
        reasonCode: 'authority_required',
        gapType: 'decision_blocker',
      }),
      question: '是否要直接修改 Jira estimate？',
      createdFrom: { kind: 'ask', refId: 'ask-decision' },
    });

    expect(result).toBeNull();
    expect(service.list().total).toBe(0);
  });
});
