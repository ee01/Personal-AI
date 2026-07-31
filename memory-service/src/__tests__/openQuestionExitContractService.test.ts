import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDb } from './setup.js';
import { EvidenceWatchContractService } from '../core/EvidenceWatchContractService.js';
import { OpenQuestionExitContractService } from '../core/OpenQuestionExitContractService.js';
import { ActionRepository } from '../repositories/ActionRepository.js';

describe('OpenQuestionExitContractService', () => {
  const db = getTestDb();
  const service = new OpenQuestionExitContractService(db);
  const evidenceWatchService = new EvidenceWatchContractService(db);
  const actionRepo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM open_question_exit_runs').run();
    db.prepare('DELETE FROM open_question_exit_contracts').run();
    db.prepare('DELETE FROM evidence_watch_links').run();
    db.prepare('DELETE FROM evidence_watch_runs').run();
    db.prepare('DELETE FROM evidence_watch_contracts').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM confirm_requests').run();
    db.prepare("DELETE FROM reflection_threads WHERE id = 'thread-watch-resume'").run();
  });

  afterEach(() => {
    db.prepare("DELETE FROM reflection_threads WHERE id = 'thread-watch-resume'").run();
  });

  it('parks a repeated question when no unseen evidence exists', () => {
    const first = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-repeat',
      subjectKey: 'project:repeat',
      questions: ['发布前还需要确认 owner 吗？'],
      evidenceRefs: ['message:release-1'],
      priority: 8,
      salience: 0.8,
      currentTime: 100,
    });
    const second = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-repeat',
      subjectKey: 'project:repeat',
      questions: ['发布前还需要确认 owner 吗？'],
      evidenceRefs: ['message:release-1'],
      priority: 8,
      salience: 0.8,
      currentTime: 200,
    });

    expect(first.primaryDecision).toMatchObject({
      active: true,
      receipt: { reasonCode: 'first_seen' },
    });
    expect(second.primaryDecision?.contract.id).toBe(
      first.primaryDecision?.contract.id,
    );
    expect(second).toMatchObject({
      activeQuestions: [],
      suppressDerivedActions: true,
      primaryDecision: {
        active: false,
        receipt: {
          state: 'parked_until_new_evidence',
          reasonCode: 'no_new_evidence',
          label: '等待新证据',
        },
      },
    });
    expect(second.primaryDecision?.contract.duplicateSuppressedCount).toBe(1);
  });

  it('does not suppress an independent action when the worker has no open question', () => {
    const result = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-no-question',
      subjectKey: 'project:no-question',
      questions: [],
      evidenceRefs: ['message:action-ready'],
      currentTime: 250,
    });

    expect(result).toEqual({
      decisions: [],
      activeQuestions: [],
      primaryDecision: undefined,
      suppressDerivedActions: false,
    });
  });

  it('parks a previously active question when the worker no longer emits it', () => {
    const first = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-missing-question',
      subjectKey: 'project:missing-question',
      questions: ['这个风险还需要继续确认吗？'],
      evidenceRefs: ['message:risk-v1'],
      currentTime: 255,
    });
    const result = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-missing-question',
      subjectKey: 'project:missing-question',
      questions: [],
      evidenceRefs: ['message:risk-v1'],
      currentTime: 256,
    });

    expect(result.suppressDerivedActions).toBe(false);
    expect(service.getById(first.primaryDecision!.contract.id)).toMatchObject({
      state: 'parked_until_new_evidence',
      reasonCode: 'no_new_evidence',
      receipt: {
        label: '等待新证据',
        boundary: '停放不是删除，历史证据和退出原因仍然保留。',
      },
    });
  });

  it('uses the first active question when an earlier question is parked', () => {
    service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-multiple',
      subjectKey: 'project:multiple',
      questions: ['旧问题是否仍需继续？'],
      evidenceRefs: ['message:old-question'],
      currentTime: 260,
    });
    const result = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-multiple',
      subjectKey: 'project:multiple',
      questions: ['旧问题是否仍需继续？', '今天发布前还要补哪项检查？'],
      evidenceRefs: ['message:old-question'],
      priority: 9,
      salience: 0.8,
      currentTime: 270,
    });

    expect(result.suppressDerivedActions).toBe(false);
    expect(result.activeQuestions).toEqual(['今天发布前还要补哪项检查？']);
    expect(result.primaryDecision).toMatchObject({
      active: true,
      contract: { questionText: '今天发布前还要补哪项检查？' },
      receipt: { reasonCode: 'first_seen' },
    });
  });

  it('hands a question to an existing queued action instead of creating more debt', () => {
    const action = actionRepo.create({
      id: 'action-owner',
      actionType: 'delegate_openclaw',
      title: '读取 Jira 当前 owner',
      threadId: 'thread-action-owner',
      queueStatus: 'queued',
      executionMode: 'auto',
    });

    const result = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-action-owner',
      subjectKey: 'project:action-owner',
      questions: ['Jira 当前 owner 是谁？'],
      evidenceRefs: ['message:owner-request'],
      priority: 8,
      salience: 0.8,
      currentTime: 300,
    });

    expect(result).toMatchObject({
      suppressDerivedActions: true,
      primaryDecision: {
        active: false,
        contract: {
          linkedActionId: action.id,
          state: 'waiting_on_existing_action',
        },
        receipt: {
          reasonCode: 'duplicate_action_pending',
          label: '已有动作处理中',
        },
      },
    });
  });

  it('resumes exactly one evaluation after an action result adds evidence', () => {
    const first = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-resume',
      subjectKey: 'project:resume',
      questions: ['今天发布前的 blocker 是否已经解除？'],
      evidenceRefs: ['message:blocker-1'],
      priority: 9,
      salience: 0.85,
      currentTime: 400,
    });
    service.linkActionOwner(first.primaryDecision!.contract.id, 'action-resume');
    service.resumeForSource({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-resume',
      reasonCode: 'action_result_available',
      evidenceRefs: ['action_result:result-1'],
      currentTime: 500,
    });

    const resumed = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-resume',
      subjectKey: 'project:resume',
      questions: ['今天发布前的 blocker 是否已经解除？'],
      evidenceRefs: ['message:blocker-1', 'action_result:result-1'],
      priority: 9,
      salience: 0.85,
      currentTime: 500,
    });
    const parkedAgain = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-resume',
      subjectKey: 'project:resume',
      questions: ['今天发布前的 blocker 是否已经解除？'],
      evidenceRefs: ['message:blocker-1', 'action_result:result-1'],
      priority: 9,
      salience: 0.85,
      currentTime: 600,
    });

    expect(resumed.primaryDecision).toMatchObject({
      active: true,
      receipt: {
        label: '新证据已恢复',
        reasonCode: 'new_authority_signal',
        userImpact: 'blocking_today',
        resumedAt: 500,
      },
    });
    expect(resumed.primaryDecision?.actionEpoch).toBeGreaterThan(
      first.primaryDecision!.actionEpoch,
    );
    expect(parkedAgain.suppressDerivedActions).toBe(true);
    expect(parkedAgain.primaryDecision?.receipt.reasonCode).toBe(
      'no_new_evidence',
    );
  });

  it('hands verification to Evidence Watch and keeps the boundary explicit', () => {
    db.prepare(
      `INSERT INTO evidence_watch_contracts
        (id, subject_key, title, question, authority_sources_json,
         verifier_json, cadence, state, stop_conditions_json,
         impact_targets_json, privacy_boundary, created_from_kind,
         created_from_ref_id, dedupe_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, '[]', '{}', 'on_revisit', 'active', '[]', '[]',
               'local_only', 'reflection', ?, ?, ?, ?)`,
    ).run(
      'watch-owner',
      'jira:release:status',
      'Release status watch',
      'Release status 是否变化？',
      'thread-watch-owner',
      'watch-owner-key',
      700,
      700,
    );

    const result = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-watch-owner',
      subjectKey: 'project:watch-owner',
      questions: ['Release status 是否变化？'],
      evidenceRefs: ['message:watch-request'],
      priority: 8,
      salience: 0.75,
      currentTime: 700,
    });

    expect(result.primaryDecision).toMatchObject({
      active: false,
      contract: {
        state: 'handoff_to_evidence_watch',
        linkedEvidenceWatchContractId: 'watch-owner',
      },
      receipt: {
        label: '已交给证据守望',
        reasonCode: 'evidence_watch_owns_verification',
      },
    });
    expect(result.primaryDecision?.receipt.boundary).toContain(
      '不代表权威来源已确认无变化',
    );
  });

  it('resumes one reflection round when Evidence Watch records an authority change', () => {
    db.prepare(
      `INSERT INTO reflection_threads
        (id, topic_key, title, status, priority, salience,
         open_questions_json, next_reflection_at, reflection_count,
         created_at, updated_at)
       VALUES (?, ?, ?, 'active', 9, 0.85, '[]', ?, 0, ?, ?)`,
    ).run(
      'thread-watch-resume',
      'project:watch-resume',
      '发布 blocker',
      9_999,
      1_000,
      1_000,
    );
    const watch = evidenceWatchService.createOrReuse({
      subjectKey: 'jira:release:blocker',
      title: '发布 blocker 状态',
      question: '今天发布前的 blocker 是否已解除？',
      authoritySources: [],
      verifier: { kind: 'source_recheck' },
      cadence: 'on_revisit',
      createdFrom: { kind: 'reflection', refId: 'thread-watch-resume' },
      createdAt: 1_000,
    });
    const handedOff = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-watch-resume',
      subjectKey: 'project:watch-resume',
      questions: ['今天发布前的 blocker 是否已解除？'],
      evidenceRefs: ['message:blocker-v1'],
      priority: 9,
      salience: 0.85,
      currentTime: 1_000,
    });

    expect(handedOff.primaryDecision?.contract).toMatchObject({
      state: 'handoff_to_evidence_watch',
      linkedEvidenceWatchContractId: watch.contract.id,
    });

    evidenceWatchService.appendRunReceipt({
      contractId: watch.contract.id,
      runState: 'checked_changed',
      summary: 'Jira authority field changed.',
      checkedSources: [
        { sourceId: 'jira:release:blocker', status: 'changed' },
      ],
      createdAt: 1_200,
    });

    const afterWatchRun = service.getById(handedOff.primaryDecision!.contract.id);
    const scheduledThread = db
      .prepare(
        `SELECT next_reflection_at, continue_reason
         FROM reflection_threads
         WHERE id = ?`,
      )
      .get('thread-watch-resume') as {
        next_reflection_at: number | null;
        continue_reason: string | null;
      };
    expect(afterWatchRun).toMatchObject({
      state: 'active',
      reasonCode: 'new_authority_signal',
      lastResumedAt: 1_200,
      receipt: { label: '新证据已恢复' },
    });
    expect(scheduledThread).toEqual({
      next_reflection_at: 1_200,
      continue_reason: 'evidence watch authority changed',
    });

    const resumed = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-watch-resume',
      subjectKey: 'project:watch-resume',
      questions: ['今天发布前的 blocker 是否已解除？'],
      evidenceRefs: ['message:blocker-v1'],
      priority: 9,
      salience: 0.85,
      currentTime: 1_200,
    });
    const parkedAgain = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-watch-resume',
      subjectKey: 'project:watch-resume',
      questions: ['今天发布前的 blocker 是否已解除？'],
      evidenceRefs: ['message:blocker-v1'],
      priority: 9,
      salience: 0.85,
      currentTime: 1_300,
    });

    expect(resumed.primaryDecision).toMatchObject({
      active: true,
      receipt: { label: '新证据已恢复', resumedAt: 1_200 },
    });
    expect(parkedAgain.primaryDecision).toMatchObject({
      active: false,
      receipt: { label: '等待新证据' },
    });
  });

  it('reuses a contract when the worker lightly rephrases the same question', () => {
    const first = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-rephrase',
      subjectKey: 'project:rephrase',
      questions: ['MTR-148115 的 DEV Estimate Original 现在还是 0.3 吗？'],
      evidenceRefs: ['jira:MTR-148115:estimate:v1'],
      currentTime: 800,
    });
    const second = service.evaluate({
      sourceKind: 'reflection_thread',
      sourceRefId: 'thread-rephrase',
      subjectKey: 'project:rephrase',
      questions: ['MTR-148115 DEV Estimate Original 是否仍然为 0.3？'],
      evidenceRefs: ['jira:MTR-148115:estimate:v1'],
      currentTime: 900,
    });

    expect(second.primaryDecision?.contract.id).toBe(
      first.primaryDecision?.contract.id,
    );
    expect(service.listBySource('reflection_thread', 'thread-rephrase')).toHaveLength(
      1,
    );
  });
});
