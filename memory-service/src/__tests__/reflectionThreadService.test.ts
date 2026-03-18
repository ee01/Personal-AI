import { beforeEach, describe, expect, it } from 'vitest';

import { getTestDb } from './setup.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { ActionResultRepository } from '../repositories/ActionResultRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';

describe('ReflectionThreadService', () => {
  const db = getTestDb();
  const repo = new ReflectionThreadRepository(db);
  const actionResultRepo = new ActionResultRepository(db);
  const actionRepo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
  });

  it('returns actionResults and hydrated action_result links in thread detail', () => {
    const thread = repo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
    });

    const action = actionRepo.create({
      id: 'action-1',
      actionType: 'delegate_openclaw',
      title: '查询 Orbit 外部进展',
      threadId: thread.id,
      runId: 'run-1',
      queueStatus: 'succeeded',
      executionMode: 'auto',
    });

    const actionResult = actionResultRepo.create({
      actionId: action.id,
      threadId: thread.id,
      runId: 'run-1',
      resultType: 'success',
      summary: '已获取到 Orbit 的外部进展摘要。',
      payload: { targetSystem: 'jira' },
    });

    const service = new ReflectionThreadService(db);
    service.recordActionResult(actionResult);

    const detail = service.getThreadDetail(thread.id);

    expect(detail).not.toBeNull();
    expect(detail?.actionResults).toHaveLength(1);
    expect(detail?.actionResults[0].summary).toContain('外部进展摘要');
    expect(detail?.links.some((link) => link.sourceKind === 'action_result')).toBe(true);
    const actionResultLink = detail?.links.find((link) => link.sourceKind === 'action_result');
    expect(actionResultLink?.previewTitle).toBe('外部委派结果');
    expect(actionResultLink?.preview).toContain('外部进展摘要');
  });
});
