import fs from 'node:fs';

import { OpenQuestionExitContractService } from '../memory-service/src/core/OpenQuestionExitContractService.js';
import { ActionRepository } from '../memory-service/src/repositories/ActionRepository.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';

interface ExitContractEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario: string;
  question: string;
  sourceRefId: string;
  subjectKey: string;
  evidenceRefs: string[];
  priority?: number;
  salience?: number;
  existingOwner?: {
    kind: 'queued_action' | 'pending_confirm' | 'evidence_watch';
    id: string;
    actionType?: string;
  };
  repeat?: {
    question?: string;
    evidenceRefs: string[];
  };
  resume?: {
    kind: 'action_result' | 'confirm_answered';
    evidenceRef: string;
  };
  expectedBehavior: {
    expectedState: string;
    expectedReasonCode: string;
    shouldSuppressDerivedActions: boolean;
    shouldResume?: boolean;
    shouldEnterTodayPilot?: boolean;
    expectedReceiptLabel: string;
    maxActionCount?: number;
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-open-question-exit-contracts.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as ExitContractEvalCase;
const db = getTestDb();

try {
  resetDb();
  const service = new OpenQuestionExitContractService(db);
  const actionRepo = new ActionRepository(db);

  if (caseItem.existingOwner?.kind === 'queued_action') {
    actionRepo.create({
      id: caseItem.existingOwner.id,
      actionType: caseItem.existingOwner.actionType ?? 'delegate_openclaw',
      title: `Existing owner for ${caseItem.title}`,
      threadId: caseItem.sourceRefId,
      queueStatus: 'queued',
      executionMode: 'auto',
    });
  }
  if (caseItem.existingOwner?.kind === 'pending_confirm') {
    db.prepare(
      `INSERT INTO confirm_requests
        (id, question, state, routing, created_at, updated_at)
       VALUES (?, ?, 'pending', 'decision', 1000, 1000)`,
    ).run(caseItem.existingOwner.id, caseItem.question);
    db.prepare(
      `INSERT INTO reflection_threads
        (id, topic_key, title, status, priority, salience, source_type,
         source_ref_id, open_questions_json, reflection_count,
         created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, 'confirm_request', ?, '[]', 0, 1000, 1000)`,
    ).run(
      caseItem.sourceRefId,
      caseItem.subjectKey,
      caseItem.title,
      caseItem.priority ?? 5,
      caseItem.salience ?? 0.5,
      caseItem.existingOwner.id,
    );
  }
  if (caseItem.existingOwner?.kind === 'evidence_watch') {
    db.prepare(
      `INSERT INTO evidence_watch_contracts
        (id, subject_key, title, question, authority_sources_json,
         verifier_json, cadence, state, stop_conditions_json,
         impact_targets_json, privacy_boundary, created_from_kind,
         created_from_ref_id, dedupe_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, '[]', '{}', 'on_revisit', 'active', '[]', '[]',
               'local_only', 'reflection', ?, ?, 1000, 1000)`,
    ).run(
      caseItem.existingOwner.id,
      caseItem.subjectKey,
      caseItem.title,
      caseItem.question,
      caseItem.sourceRefId,
      `${caseItem.id}:watch`,
    );
  }

  const first = service.evaluate({
    sourceKind: 'reflection_thread',
    sourceRefId: caseItem.sourceRefId,
    subjectKey: caseItem.subjectKey,
    questions: [caseItem.question],
    evidenceRefs: caseItem.evidenceRefs,
    priority: caseItem.priority,
    salience: caseItem.salience,
    currentTime: 1000,
  });
  let final = first;

  if (caseItem.repeat) {
    final = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: caseItem.sourceRefId,
      subjectKey: caseItem.subjectKey,
      questions: [caseItem.repeat.question ?? caseItem.question],
      evidenceRefs: caseItem.repeat.evidenceRefs,
      priority: caseItem.priority,
      salience: caseItem.salience,
      currentTime: 1100,
    });
  }

  if (caseItem.resume) {
    const contractId = first.primaryDecision?.contract.id;
    if (contractId && !caseItem.existingOwner) {
      service.linkActionOwner(contractId, `${caseItem.id}:action-owner`);
    }
    service.resumeForSource({
      sourceKind: 'reflection_thread',
      sourceRefId: caseItem.sourceRefId,
      reasonCode:
        caseItem.resume.kind === 'confirm_answered'
          ? 'confirm_answered'
          : 'action_result_available',
      evidenceRefs: [caseItem.resume.evidenceRef],
      currentTime: 1200,
    });
    final = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: caseItem.sourceRefId,
      subjectKey: caseItem.subjectKey,
      questions: [caseItem.question],
      evidenceRefs: [...caseItem.evidenceRefs, caseItem.resume.evidenceRef],
      priority: caseItem.priority,
      salience: caseItem.salience,
      currentTime: 1200,
    });
  }

  const decision = final.primaryDecision;
  const contract = decision?.contract;
  const receipt = decision?.receipt;
  const actionCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM proposed_actions
         WHERE thread_id = ?`,
      )
      .get(caseItem.sourceRefId) as { count: number }
  ).count;
  const todayPilotEligible = Boolean(
    contract?.state === 'active' &&
      contract.userImpact === 'blocking_today' &&
      contract.lastResumedAt,
  );
  const expected = caseItem.expectedBehavior;
  const failures: string[] = [];

  if (contract?.state !== expected.expectedState) {
    failures.push(
      `contract state=${contract?.state ?? 'missing'}，期望 ${expected.expectedState}。`,
    );
  }
  if (receipt?.reasonCode !== expected.expectedReasonCode) {
    failures.push(
      `reasonCode=${receipt?.reasonCode ?? 'missing'}，期望 ${expected.expectedReasonCode}。`,
    );
  }
  if (final.suppressDerivedActions !== expected.shouldSuppressDerivedActions) {
    failures.push(
      `suppressDerivedActions=${final.suppressDerivedActions}，期望 ${expected.shouldSuppressDerivedActions}。`,
    );
  }
  if (receipt?.label !== expected.expectedReceiptLabel) {
    failures.push(
      `receipt label=${receipt?.label ?? 'missing'}，期望 ${expected.expectedReceiptLabel}。`,
    );
  }
  if (expected.shouldResume && !contract?.lastResumedAt) {
    failures.push('预期恢复，但 contract 没有 lastResumedAt。');
  }
  if (
    expected.shouldEnterTodayPilot !== undefined &&
    todayPilotEligible !== expected.shouldEnterTodayPilot
  ) {
    failures.push(
      `Today Pilot eligibility=${todayPilotEligible}，期望 ${expected.shouldEnterTodayPilot}。`,
    );
  }
  if (
    expected.maxActionCount !== undefined &&
    actionCount > expected.maxActionCount
  ) {
    failures.push(
      `action count=${actionCount}，超过上限 ${expected.maxActionCount}。`,
    );
  }

  const scores = {
    lifecycleDecision:
      contract?.state === expected.expectedState &&
      receipt?.reasonCode === expected.expectedReasonCode
        ? 100
        : 0,
    duplicateSuppression:
      final.suppressDerivedActions === expected.shouldSuppressDerivedActions
        ? 100
        : 0,
    resumeBoundary:
      expected.shouldEnterTodayPilot === undefined ||
      todayPilotEligible === expected.shouldEnterTodayPilot
        ? 100
        : 0,
    receiptClarity:
      receipt?.label === expected.expectedReceiptLabel &&
      Boolean(receipt.boundary) &&
      Boolean(receipt.nextStep)
        ? 100
        : 0,
  };
  const verdict = failures.length ? 'fail' : 'pass';
  const overallScore = failures.length
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
        '问题退出、owner 交接、新证据恢复和 Today Pilot 边界均符合预期。',
      userConclusion: failures.length
        ? '不通过：开放问题仍可能重复推进、错误恢复或进入不合适的主动展示面。'
        : '通过：无新证据的问题会退出，已有 owner 不重复建动作，新证据只恢复一轮并按需进入 Today Pilot。',
      improvementSuggestions: failures.length
        ? failures
        : ['继续扩充真实确认请求、来源阻塞和用户主动重问样本。'],
      actualOutput: {
        firstDecision: first.primaryDecision,
        finalDecision: decision,
        actionCount,
        todayPilotEligible,
        runCount: contract ? service.listRuns(contract.id).length : 0,
      },
      topMatch: contract
        ? {
            id: contract.id,
            title: contract.questionText,
            sourceLabel: contract.subjectKey,
            displayPriority: contract.state,
            whyRelevant: [
              `reason=${contract.reasonCode}`,
              `impact=${contract.userImpact}`,
              `suppressed=${contract.duplicateSuppressedCount}`,
            ],
          }
        : null,
    }),
  );
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM open_question_exit_runs').run();
  db.prepare('DELETE FROM open_question_exit_contracts').run();
  db.prepare('DELETE FROM evidence_watch_links').run();
  db.prepare('DELETE FROM evidence_watch_runs').run();
  db.prepare('DELETE FROM evidence_watch_contracts').run();
  db.prepare('DELETE FROM proposed_action_attempts').run();
  db.prepare('DELETE FROM proposed_actions').run();
  db.prepare('DELETE FROM reflection_threads').run();
  db.prepare('DELETE FROM confirm_requests').run();
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}
