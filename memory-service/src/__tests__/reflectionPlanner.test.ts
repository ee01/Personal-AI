import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getTestDb } from './setup.js';
import { ReflectionPlanner } from '../core/ReflectionPlanner.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('ReflectionPlanner', () => {
  const db = getTestDb();
  const threadRepo = new ReflectionThreadRepository(db);
  const actionRepo = new ActionRepository(db);
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
});
