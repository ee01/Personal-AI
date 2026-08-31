import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getTestDb } from './setup.js';
import { ReflectionPlanner } from '../core/ReflectionPlanner.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { OutreachRepository } from '../repositories/OutreachRepository.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('ReflectionPlanner', () => {
  const db = getTestDb();
  const threadRepo = new ReflectionThreadRepository(db);
  const actionRepo = new ActionRepository(db);
  const outreachRepo = new OutreachRepository(db);
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    db.prepare('DELETE FROM worker_checkpoints').run();
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
    db.prepare('DELETE FROM confirm_requests').run();
    db.prepare('DELETE FROM user_profile_items').run();
    db.prepare('DELETE FROM entity_properties').run();
    db.prepare('DELETE FROM messages_raw').run();
    // Baseline: these tests exercise the blocking/defer logic for an
    // otherwise-active user, not the idle-sleep safety net (see the
    // dedicated 'idle-sleep safety net' describe block below, which clears
    // this row to model a genuinely idle user).
    db.prepare(
      `INSERT INTO messages_raw (id, content, source_type, timestamp, created_at)
       VALUES ('msg-baseline-active', 'baseline activity', 'glip', ?, ?)`,
    ).run(Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000));

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflection-planner-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        reflectionEnabled: true,
        reflectionHeartbeatMinutes: 15,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('skips heartbeat reflection when a delegate_openclaw action is pending', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: currentTime - 60,
    });

    actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 BE 进展',
      description: '等待外部系统返回结果',
      threadId: thread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
    const planner = new ReflectionPlanner(db, userDataManager, 'test-user');
    const result = await planner.runHeartbeat();

    expect(runSpy).not.toHaveBeenCalled();
    expect(result.runsCreated).toBe(0);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).toBe('waiting_for_delegation');
    expect((updatedThread?.nextReflectionAt ?? 0)).toBeGreaterThan(currentTime);
    expect(updatedThread?.reflectionCount).toBe(0);
    expect(updatedThread?.lastReflectedAt).toBeUndefined();
  });

  it('continues heartbeat reflection when delegation actions are already finished', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: currentTime - 60,
    });

    actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '旧的外部查询',
      description: '已经失败，不应继续阻塞 heartbeat',
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'failed',
    });

    const runSpy = vi
      .spyOn(ReflectionThreadService.prototype, 'runReflection')
      .mockResolvedValue({
        thread: threadRepo.getThreadById(thread.id)!,
        run: {
          id: 'run-1',
          threadId: thread.id,
          runType: 'continuous_reflection',
          triggerType: 'heartbeat',
          summary: 'heartbeat reran',
          inputRefs: [],
          discoveries: [],
          openQuestions: [],
          actions: [],
          createdAt: currentTime,
        },
        actions: [],
      });

    const planner = new ReflectionPlanner(db, userDataManager, 'test-user');
    const result = await planner.runHeartbeat();

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(result.runsCreated).toBe(1);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).not.toBe('waiting_for_delegation');
  });

  it('skips heartbeat reflection when a linked confirm request is still pending', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const thread = threadRepo.upsertThread({
      topicKey: 'message:mtr-144628',
      title: '消息追踪: MTR-144628',
      status: 'active',
      priority: 9,
      salience: 0.92,
      nextReflectionAt: currentTime - 60,
    });

    const action = actionRepo.create({
      actionType: 'create_confirm_request',
      title: 'Request user approval for read-only Jira query',
      description: 'Need a user decision before proceeding.',
      threadId: thread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
    });
    db.prepare(
      `UPDATE proposed_actions
       SET queue_status = 'succeeded',
           state = 'executed',
           result_json = ?
       WHERE id = ?`,
    ).run(JSON.stringify({ confirmRequestId: 'cr-pending-1' }), action.id);
    db.prepare(
      `INSERT INTO confirm_requests
        (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(
      'cr-pending-1',
      'Should this Jira query be allowed?',
      'Read-only access still needs confirmation.',
      JSON.stringify([{ label: 'Allow', value: 'allow' }]),
      JSON.stringify([]),
      'reflection',
      'high',
      currentTime,
    );

    const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
    const planner = new ReflectionPlanner(db, userDataManager, 'test-user');
    const result = await planner.runHeartbeat();

    expect(runSpy).not.toHaveBeenCalled();
    expect(result.runsCreated).toBe(0);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).toBe('waiting_for_confirm_request');
    expect((updatedThread?.nextReflectionAt ?? 0)).toBeGreaterThan(currentTime);
    expect(updatedThread?.reflectionCount).toBe(0);
    expect(updatedThread?.lastReflectedAt).toBeUndefined();
  });

  it('skips heartbeat reflection when outreach is waiting for approval or reply', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit-outreach',
      title: '项目反思: Orbit Outreach',
      status: 'active',
      priority: 8,
      salience: 0.88,
      nextReflectionAt: currentTime - 60,
    });

    outreachRepo.createSession({
      id: 'outreach-1',
      originKind: 'reflection_action',
      threadId: thread.id,
      targetType: 'person',
      targetRef: 'maya',
      renderedQuestion: 'Can you confirm the rollout status?',
      status: 'waiting_reply',
      requiresApproval: false,
      nextCheckAt: currentTime + 300,
    });

    const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
    const planner = new ReflectionPlanner(db, userDataManager, 'test-user');
    const result = await planner.runHeartbeat();

    expect(runSpy).not.toHaveBeenCalled();
    expect(result.runsCreated).toBe(0);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).toBe('waiting_for_outreach');
    expect(updatedThread?.reflectionCount).toBe(0);
    expect(updatedThread?.lastReflectedAt).toBeUndefined();
  });

  it('skips heartbeat reflection when a manual action is still queued', async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit-manual',
      title: '项目反思: Orbit Manual',
      status: 'active',
      priority: 7,
      salience: 0.8,
      nextReflectionAt: currentTime - 60,
    });

    actionRepo.create({
      actionType: 'notify_user',
      title: 'Need manual notification review',
      description: 'Still waiting for manual approval.',
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
      requiresApproval: true,
    });

    const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
    const planner = new ReflectionPlanner(db, userDataManager, 'test-user');
    const result = await planner.runHeartbeat();

    expect(runSpy).not.toHaveBeenCalled();
    expect(result.runsCreated).toBe(0);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).toBe('waiting_for_manual_action');
    expect(updatedThread?.reflectionCount).toBe(0);
    expect(updatedThread?.lastReflectedAt).toBeUndefined();
  });

  describe('idle-sleep safety net', () => {
    it('skips runReflection for a due thread when the user has no recent message activity', async () => {
      // Remove the beforeEach baseline row — this test models a genuinely
      // idle user (zong.zheng's actual shape: active threads, zero recent
      // activity), not the "active user, blocked on something" default.
      db.prepare('DELETE FROM messages_raw').run();
      const currentTime = Math.floor(Date.now() / 1000);
      threadRepo.upsertThread({
        topicKey: 'entity:zong-idle',
        title: '闲置用户遗留线程',
        status: 'active',
        priority: 8,
        salience: 0.9,
        nextReflectionAt: currentTime - 60,
      });
      // No messages_raw rows inserted — this is exactly zong.zheng's
      // situation: active threads with zero front-end activity.

      const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
      const planner = new ReflectionPlanner(db, userDataManager, 'idle-user');
      const result = await planner.runHeartbeat();

      expect(runSpy).not.toHaveBeenCalled();
      expect(result.runsCreated).toBe(0);
      expect(result.idlePaused).toBe(true);
    });

    it('still runs reflection for a due thread when the user has recent message activity', async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const thread = threadRepo.upsertThread({
        topicKey: 'entity:active-user',
        title: '活跃用户线程',
        status: 'active',
        priority: 8,
        salience: 0.9,
        nextReflectionAt: currentTime - 60,
      });
      db.prepare(
        `INSERT INTO messages_raw (id, content, source_type, timestamp, created_at)
         VALUES (?, ?, 'glip', ?, ?)`,
      ).run('msg-recent-1', 'still talking to the team', currentTime, currentTime - 30);

      const runSpy = vi
        .spyOn(ReflectionThreadService.prototype, 'runReflection')
        .mockResolvedValue({
          thread: threadRepo.getThreadById(thread.id)!,
          run: {
            id: 'run-active',
            threadId: thread.id,
            runType: 'continuous_reflection',
            triggerType: 'heartbeat',
            summary: 'active user reran',
            inputRefs: [],
            discoveries: [],
            openQuestions: [],
            actions: [],
            createdAt: currentTime,
          },
          actions: [],
        });

      const planner = new ReflectionPlanner(db, userDataManager, 'active-user');
      const result = await planner.runHeartbeat();

      expect(runSpy).toHaveBeenCalledTimes(1);
      expect(result.idlePaused).toBe(false);
    });
  });
});
