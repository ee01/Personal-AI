import fs from 'node:fs';

import {
  EvidenceWatchContractService,
  type EvidenceWatchRunState,
} from '../memory-service/src/core/EvidenceWatchContractService.js';
import type { EvidenceResolutionPlan } from '../memory-service/src/core/EvidenceResolutionPlanner.js';
import { ActionRepository } from '../memory-service/src/repositories/ActionRepository.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';

interface EvidenceWatchEvalAction {
  actionType: string;
  title: string;
  duplicateAttempts?: number;
}

interface EvidenceWatchEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario?: string;
  question: string;
  plan: EvidenceResolutionPlan;
  action?: EvidenceWatchEvalAction;
  runReceipts?: Array<{
    runState: EvidenceWatchRunState;
    summary: string;
    userVisible?: boolean;
  }>;
  expectedBehavior?: {
    shouldCreateContract?: boolean;
    shouldReuseContract?: boolean;
    shouldSuppressDuplicates?: boolean;
    expectedState?: string;
    expectedReceiptLabels?: string[];
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-evidence-watch-contracts.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as EvidenceWatchEvalCase;
const db = getTestDb();

try {
  resetDb();

  const service = new EvidenceWatchContractService(db);
  const first = service.createOrReuseFromPlan({
    plan: caseItem.plan,
    question: caseItem.question,
    title: caseItem.title,
    createdFrom: { kind: 'ask', refId: `${caseItem.id}-ask-1` },
    cadence: 'on_ask',
  });
  const second = service.createOrReuseFromPlan({
    plan: caseItem.plan,
    question: `${caseItem.question} 有没有新的变化？`,
    title: caseItem.title,
    createdFrom: { kind: 'ask', refId: `${caseItem.id}-ask-2` },
    cadence: 'on_ask',
  });

  let duplicateSuppressions = 0;
  const actionIds: string[] = [];
  if (first && caseItem.action) {
    const actionRepo = new ActionRepository(db);
    const prep = service.prepareActionForPlan({
      plan: caseItem.plan,
      question: caseItem.question,
      title: caseItem.title,
      createdFrom: { kind: 'reflection', refId: `${caseItem.id}-thread` },
      actionType: caseItem.action.actionType,
      cadence: 'on_revisit',
    });
    if (prep) {
      for (
        let index = 0;
        index < Math.max(1, caseItem.action.duplicateAttempts ?? 1);
        index += 1
      ) {
        const existing = actionRepo.findReusableByIdempotencyKey(
          prep.idempotencyKey,
        );
        const action = actionRepo.create({
          actionType: caseItem.action.actionType,
          title:
            index === 0
              ? caseItem.action.title
              : `${caseItem.action.title} duplicate ${index}`,
          params: prep.paramsPatch,
          executionMode: 'auto',
          requiresApproval: false,
          queueStatus: 'queued',
          idempotencyKey: prep.idempotencyKey,
        });
        actionIds.push(action.id);
        const receipt = service.recordActionResult({
          contractId: prep.contract.id,
          action,
          wasDuplicate: Boolean(existing) && existing?.id === action.id,
        });
        if (receipt?.runState === 'skipped_duplicate') {
          duplicateSuppressions += 1;
        }
      }
    }
  }

  if (first) {
    for (const receipt of caseItem.runReceipts ?? []) {
      service.appendRunReceipt({
        contractId: first.contract.id,
        runState: receipt.runState,
        summary: receipt.summary,
        userVisible: receipt.userVisible,
      });
    }
  }

  const contract = first ? service.getById(first.contract.id) : null;
  const uiReceipt = contract ? service.toUiReceipt(contract) : null;
  const failures: string[] = [];
  const warnings: string[] = [];
  const expected = caseItem.expectedBehavior ?? {};

  if (expected.shouldCreateContract !== false && !first) {
    failures.push('没有为 future-monitoring 场景创建 Evidence Watch Contract。');
  }
  if (expected.shouldCreateContract === false && first) {
    failures.push('普通决策场景不应创建 Evidence Watch Contract。');
  }
  if (expected.shouldReuseContract && first?.contract.id !== second?.contract.id) {
    failures.push('同一 subject/gap 的二次问题没有复用同一个 contract。');
  }
  if (
    expected.shouldSuppressDuplicates &&
    duplicateSuppressions < Math.max(1, (caseItem.action?.duplicateAttempts ?? 1) - 1)
  ) {
    failures.push('重复 action 没有留下 skipped_duplicate 收据。');
  }
  if (expected.expectedState && contract?.state !== expected.expectedState) {
    failures.push(
      `contract state=${contract?.state ?? 'missing'}，期望 ${expected.expectedState}。`,
    );
  }
  for (const label of expected.expectedReceiptLabels ?? []) {
    if (uiReceipt?.label !== label) {
      warnings.push(`当前 receipt label=${uiReceipt?.label ?? 'missing'}，期望包含 ${label}。`);
    }
  }

  const scores = {
    contractCreated: first ? 100 : 0,
    contractReused: first && second?.contract.id === first.contract.id ? 100 : 0,
    duplicateSuppression:
      expected.shouldSuppressDuplicates === false
        ? 100
        : duplicateSuppressions > 0
          ? 100
          : 0,
    receiptClarity: uiReceipt?.label && uiReceipt.detail ? 100 : 0,
  };
  const verdict = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';
  const overallScore =
    verdict === 'fail'
      ? Math.min(scoreAverage(scores), 49)
      : scoreAverage(scores);

  console.log(
    JSON.stringify({
      status: verdict,
      verdict,
      scores,
      overallScore,
      why:
        failures[0] ||
        warnings[0] ||
        'Evidence Watch Contract 创建、复用、重复动作收据均符合预期。',
      userConclusion: failures.length
        ? '不通过：可变化事实仍可能重复创建查证动作或缺少复核收据。'
        : warnings.length
          ? '需关注：核心行为通过，但用户可见 receipt 文案还可更精确。'
          : '通过：可变化事实会进入同一个守望契约，重复外部查证被合并并留下收据。',
      improvementSuggestions: failures.length
        ? failures
        : warnings.length
          ? warnings
          : [
              '继续补充真实 Jira estimate、AI tool status、source blocked 样本，覆盖更多 sourceAnchor 形态。',
            ],
      actualOutput: {
        contract,
        uiReceipt,
        duplicateSuppressions,
        actionIds: Array.from(new Set(actionIds)),
        runCount: contract ? service.listRuns(contract.id).length : 0,
      },
      topMatch: contract
        ? {
            id: contract.id,
            title: contract.title,
            sourceLabel: contract.authoritySources[0]?.title ?? contract.subjectKey,
            displayPriority: contract.state,
            whyRelevant: [
              `subject=${contract.subjectKey}`,
              `cadence=${contract.cadence}`,
              `duplicates=${uiReceipt?.duplicateSuppressedCount ?? 0}`,
            ],
          }
        : null,
    }),
  );
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM evidence_watch_links').run();
  db.prepare('DELETE FROM evidence_watch_runs').run();
  db.prepare('DELETE FROM evidence_watch_contracts').run();
  db.prepare('DELETE FROM proposed_action_attempts').run();
  db.prepare('DELETE FROM proposed_actions').run();
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}
