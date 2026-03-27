import { beforeEach, describe, expect, it } from 'vitest';

import { ActionRepository } from '../repositories/ActionRepository.js';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { getTestDb } from './setup.js';

describe('ConfirmRequestRepository', () => {
  const db = getTestDb();
  const repo = new ConfirmRequestRepository(db);
  const actionRepo = new ActionRepository(db);
  const threadRepo = new ReflectionThreadRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
    db.prepare('DELETE FROM confirm_requests').run();
  });

  it('reuses an existing pending confirm request and merges metadata', () => {
    const first = repo.createOrReusePending({
      id: 'cr-1',
      question: '请求用户确认已收到通知',
      context: 'Project Orbit 风险已经推送，请确认是否收到。',
      options: [
        { label: '已收到', value: 'received' },
        { label: '未收到', value: 'not_received' },
      ],
      evidenceRefs: ['message:orbit-1'],
      category: 'reflection',
      relatedEntityId: 'entity-project-orbit',
      priority: 'normal',
      createdAt: 1,
    });
    const second = repo.createOrReusePending({
      id: 'cr-2',
      question: '请求用户确认已收到通知',
      context: 'Project Orbit 风险已经推送，请确认是否收到。',
      options: [
        { label: '已收到', value: 'received' },
        { label: '未收到', value: 'not_received' },
      ],
      evidenceRefs: ['message:orbit-2'],
      category: 'reflection',
      relatedEntityId: 'entity-project-orbit',
      priority: 'high',
      createdAt: 2,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.id).toBe('cr-1');
    expect(second.record.priority).toBe('high');
    expect(second.record.evidenceRefs).toEqual(['message:orbit-1', 'message:orbit-2']);

    const rows = db
      .prepare(`SELECT id, state, dedupe_key FROM confirm_requests`)
      .all() as Array<{ id: string; state: string; dedupe_key: string | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'cr-1',
      state: 'pending',
    });
    expect(rows[0].dedupe_key).toBeTruthy();
  });

  it('deduplicates pending confirm requests and remaps linked actions', () => {
    db.prepare(
      `INSERT INTO confirm_requests
        (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(
      'cr-old',
      'Request user confirmation on Jira ticket info',
      'User confirmation is needed to ensure the retrieved information about MTR-144628 is up-to-date and sufficient for their needs.',
      JSON.stringify([{ label: 'OK', value: 'ok' }]),
      JSON.stringify(['message:1']),
      'reflection',
      'normal',
      10,
    );
    db.prepare(
      `INSERT INTO confirm_requests
        (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(
      'cr-new',
      'Request user confirmation on Jira ticket info',
      'Explicit user confirmation is needed to verify that the retrieved information about MTR-144628 is up-to-date and sufficient for the read-only validation scenario.',
      JSON.stringify([{ label: 'OK', value: 'ok' }]),
      JSON.stringify(['message:2']),
      'reflection',
      'high',
      20,
    );

    threadRepo.upsertThread({
      topicKey: 'confirm_request:cr-old',
      title: '决策跟进: old',
      status: 'active',
      priority: 5,
      salience: 0.8,
      sourceType: 'confirm_request',
      sourceRefId: 'cr-old',
      nextReflectionAt: 10,
    });
    threadRepo.upsertThread({
      topicKey: 'confirm_request:cr-new',
      title: '决策跟进: new',
      status: 'active',
      priority: 5,
      salience: 0.8,
      sourceType: 'confirm_request',
      sourceRefId: 'cr-new',
      nextReflectionAt: 20,
    });

    const action = actionRepo.create({
      actionType: 'create_confirm_request',
      title: 'Request user confirmation on Jira ticket info',
      threadId: 'origin-thread',
      runId: 'run-1',
      executionMode: 'auto',
      queueStatus: 'succeeded',
      createdAt: 25,
    });
    db.prepare('UPDATE proposed_actions SET result_json = ? WHERE id = ?').run(
      JSON.stringify({ confirmRequestId: 'cr-old' }),
      action.id,
    );

    const followupAction = actionRepo.create({
      actionType: 'create_confirm_request',
      title: 'Request user confirmation on Jira ticket info',
      threadId: 'origin-thread',
      runId: 'run-2',
      executionMode: 'auto',
      queueStatus: 'succeeded',
      createdAt: 30,
    });
    db.prepare('UPDATE proposed_actions SET result_json = ? WHERE id = ?').run(
      JSON.stringify({ confirmRequestId: 'cr-new' }),
      followupAction.id,
    );

    const summary = repo.dedupePendingRequests();
    const backfilled = repo.backfillDedupeKeys();

    expect(summary.duplicateGroups).toBe(1);
    expect(summary.mergedRequests).toBe(1);
    expect(summary.canonicalIds).toEqual(['cr-old']);
    expect(backfilled).toBe(2);

    const canonical = repo.getById('cr-old');
    const duplicate = repo.getById('cr-new');
    expect(canonical?.state).toBe('pending');
    expect(canonical?.priority).toBe('high');
    expect(canonical?.evidenceRefs).toEqual(['message:1', 'message:2']);
    expect(canonical?.dedupeKey).toBeTruthy();
    expect(duplicate?.state).toBe('deduplicated');
    expect(duplicate?.userAnswer).toContain('cr-old');
    expect(duplicate?.dedupeKey).toBe(canonical?.dedupeKey);

    const updatedAction = db
      .prepare(`SELECT json_extract(result_json, '$.confirmRequestId') AS confirm_request_id FROM proposed_actions WHERE id = ?`)
      .get(followupAction.id) as { confirm_request_id: string | null };
    expect(updatedAction.confirm_request_id).toBe('cr-old');

    const duplicateThread = db
      .prepare(`SELECT status, closure_reason FROM reflection_threads WHERE source_ref_id = 'cr-new'`)
      .get() as { status: string; closure_reason: string | null } | undefined;
    expect(duplicateThread).toMatchObject({
      status: 'closed',
      closure_reason: 'duplicate confirm request merged',
    });
  });
});
