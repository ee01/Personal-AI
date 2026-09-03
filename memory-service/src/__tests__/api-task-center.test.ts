import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { resolveLane, findDependencyCycle } from '../routes/taskCenter.js';
import { getTestDb } from './setup.js';

describe('Task Center API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  function post(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/api/v1/task-center/tasks', payload });
  }

  describe('lane routing', () => {
    it('puts a push on the cloud lane when Level 2 is available', async () => {
      const res = await post({
        taskKind: 'push',
        title: '每天 9 点报表',
        lane: 'jira_sheet',
        cloudLaneAvailable: true,
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.task.lane).toBe('jira_sheet');
      expect(body.lane.honoredRequest).toBe(true);
      // The extension owns the Sheet write, so the caller must be told.
      expect(body.mirrorRequired).toBe(true);
    });

    it('falls back to local when the cloud lane was asked for without Level 2', async () => {
      const res = await post({
        taskKind: 'push',
        title: '每天 9 点报表',
        lane: 'jira_sheet',
        cloudLaneAvailable: false,
      });
      const body = res.json();
      expect(body.task.lane).toBe('memory_cron');
      expect(body.lane.honoredRequest).toBe(false);
      expect(body.lane.reason).toContain('Level 2');
      expect(body.mirrorRequired).toBe(false);
    });

    it('pins reminders to local even when the cloud lane is available', async () => {
      const res = await post({
        taskKind: 'remind',
        title: '回复 Kenny',
        lane: 'jira_sheet',
        cloudLaneAvailable: true,
      });
      const body = res.json();
      expect(body.task.lane).toBe('memory_cron');
      expect(body.lane.honoredRequest).toBe(false);
    });

    it('pins dev delegations to local', async () => {
      const res = await post({
        taskKind: 'dev',
        title: 'lease 续租',
        lane: 'jira_sheet',
        cloudLaneAvailable: true,
      });
      expect(res.json().task.lane).toBe('memory_cron');
    });

    it('defaults to local when no lane is requested', async () => {
      const res = await post({ taskKind: 'agent', title: '查 Jira' });
      expect(res.json().task.lane).toBe('memory_cron');
      expect(res.json().lane.honoredRequest).toBe(true);
    });

    it('resolveLane is pure and covers each kind', () => {
      expect(resolveLane({ taskKind: 'push', requestedLane: 'jira_sheet', cloudLaneAvailable: true }).lane)
        .toBe('jira_sheet');
      expect(resolveLane({ taskKind: 'agent', requestedLane: 'jira_sheet', cloudLaneAvailable: true }).lane)
        .toBe('jira_sheet');
      for (const kind of ['remind', 'dev', 'reflection', 'outreach'] as const) {
        expect(resolveLane({ taskKind: kind, requestedLane: 'jira_sheet', cloudLaneAvailable: true }).lane)
          .toBe('memory_cron');
      }
    });
  });

  describe('action type routing', () => {
    it('stores a plain push as notify_user so home-lane delivery does not need an executor', async () => {
      const res = await post({
        taskKind: 'push',
        title: '每晚提醒清 inbox',
        payload: { pushMethod: 'message', channel: 'plugin' },
      });
      expect(res.statusCode).toBe(201);
      const id = res.json().task.id as string;
      const stored = new ActionRepository(db).getById(id);
      expect(stored?.actionType).toBe('notify_user');
      expect(stored?.params?.channel).toBe('plugin');
    });

    it('stores an AI Report push as run_http_push', async () => {
      const res = await post({
        taskKind: 'push',
        title: '无 Assignee bug',
        payload: { pushMethod: 'ai', content: 'assignee is EMPTY' },
      });
      expect(new ActionRepository(db).getById(res.json().task.id)?.actionType).toBe(
        'run_http_push',
      );
    });

    it('stores 帮我问 as ask_external_user', async () => {
      const res = await post({
        taskKind: 'outreach',
        title: '问 Kenny 分页',
        payload: { question: '分页这样改行吗', targetRef: 'kenny.hu' },
      });
      expect(new ActionRepository(db).getById(res.json().task.id)?.actionType).toBe(
        'ask_external_user',
      );
    });

    it('keeps agent tasks on delegate_agent and copies notify metadata', async () => {
      const res = await post({
        taskKind: 'agent',
        title: 'Nova 缺 Team',
        payload: {
          task: '查 JQL',
          notifyVia: 'bot',
          notifyTarget: { type: 'group', targetGroupId: '164506140678' },
        },
      });
      const stored = new ActionRepository(db).getById(res.json().task.id);
      expect(stored?.actionType).toBe('delegate_agent');
      const metadata = stored?.params?.metadata as Record<string, unknown>;
      expect(metadata.notifyVia).toBe('bot');
      expect(metadata.notifyTarget).toMatchObject({
        type: 'group',
        targetGroupId: '164506140678',
      });
    });

    it('keeps notifyWhenEmpty unset when the task never chose', async () => {
      const chosen = await post({
        taskKind: 'agent',
        title: '回填 Team',
        payload: { task: '回填', mode: 'write', notifyWhenEmpty: false },
      });
      const untouched = await post({
        taskKind: 'agent',
        title: '查 Team',
        payload: { task: '查询' },
      });

      const repo = new ActionRepository(db);
      const chosenMetadata = repo.getById(chosen.json().task.id)?.params?.metadata as Record<
        string,
        unknown
      >;
      const untouchedMetadata = repo.getById(untouched.json().task.id)?.params?.metadata as Record<
        string,
        unknown
      >;
      expect(chosenMetadata.notifyWhenEmpty).toBe(false);
      expect(untouchedMetadata.notifyWhenEmpty).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('rejects an unknown task kind', async () => {
      const res = await post({ taskKind: 'nonsense', title: 'x' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_task_kind');
    });

    it('requires a title', async () => {
      const res = await post({ taskKind: 'push', title: '   ' });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a dependency cycle instead of creating a task that never runs', async () => {
      const repo = new ActionRepository(db);
      const a = repo.create({ actionType: 'notify_user', title: 'A' });
      const b = repo.create({ actionType: 'notify_user', title: 'B', dependsOn: [a.id] });
      // Make A depend on B, closing the loop.
      db.prepare('UPDATE proposed_actions SET depends_on_json = ? WHERE id = ?')
        .run(JSON.stringify([b.id]), a.id);

      const res = await post({ taskKind: 'dev', title: 'C', dependsOn: [a.id] });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('dependency_cycle');
    });

    it('accepts a valid dependency chain', async () => {
      const repo = new ActionRepository(db);
      const a = repo.create({ actionType: 'notify_user', title: 'A' });
      const res = await post({ taskKind: 'dev', title: 'B', dependsOn: [a.id] });
      expect(res.statusCode).toBe(201);
      expect(res.json().task.dependsOn).toEqual([a.id]);
    });

    it('rejects an unknown parent', async () => {
      const res = await post({ taskKind: 'dev', title: 'child', parentActionId: 'nope' });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('parent_not_found');
    });

    it('findDependencyCycle detects self-dependency', () => {
      const repo = { getById: () => null } as never;
      expect(findDependencyCycle(repo, ['__new__'])).not.toBeNull();
    });
  });

  describe('listing', () => {
    it('filters by kind and lane', async () => {
      await post({ taskKind: 'push', title: 'p1', lane: 'jira_sheet', cloudLaneAvailable: true });
      await post({ taskKind: 'remind', title: 'r1' });

      const pushes = await app.inject({
        method: 'GET',
        url: '/api/v1/task-center/tasks?taskKind=push',
      });
      expect(pushes.json().items).toHaveLength(1);
      expect(pushes.json().items[0].taskKind).toBe('push');

      const local = await app.inject({
        method: 'GET',
        url: '/api/v1/task-center/tasks?lane=memory_cron',
      });
      expect(local.json().items.every((t: any) => t.lane === 'memory_cron')).toBe(true);
    });

    it('reports lane capabilities so the editor can grey correctly', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/task-center/capabilities' });
      expect(res.json().laneSelectableKinds).toEqual(['push', 'agent']);
      expect(res.json().lanes).toEqual(['memory_cron', 'jira_sheet']);
    });
  });

  it('exposes a manual sweep', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/task-center/sweep' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('rolledOver');
    expect(res.json()).toHaveProperty('parentsCompleted');
  });
});

describe('Task Center task updates', () => {
  let app2: FastifyInstance;
  let db2: BetterSqlite3.Database;

  beforeAll(async () => {
    db2 = getTestDb();
    const result = await buildApp({ db: db2 });
    app2 = result.app;
    await app2.ready();
  });

  afterAll(async () => {
    await app2.close();
  });

  beforeEach(() => {
    // Attempts reference actions, so they must go first.
    db2.prepare('DELETE FROM proposed_action_attempts').run();
    db2.prepare('DELETE FROM proposed_actions').run();
  });

  async function createRemind(idempotencyKey: string) {
    const res = await app2.inject({
      method: 'POST',
      url: '/api/v1/task-center/tasks',
      payload: { taskKind: 'remind', title: '回复 Kenny', idempotencyKey, scheduledAt: 1000 },
    });
    return res.json().task;
  }

  it('finds a task by the key its entry point used, so re-snooze can reuse it', async () => {
    const task = await createRemind('snooze:msg-1');
    const res = await app2.inject({
      method: 'GET',
      url: '/api/v1/task-center/tasks/by-key?idempotencyKey=snooze%3Amsg-1',
    });
    expect(res.json().task.id).toBe(task.id);
  });

  it('returns null for an unknown key rather than erroring', async () => {
    const res = await app2.inject({
      method: 'GET',
      url: '/api/v1/task-center/tasks/by-key?idempotencyKey=nope',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().task).toBeNull();
  });

  it('reschedules instead of stacking a duplicate reminder', async () => {
    const task = await createRemind('snooze:msg-2');
    const res = await app2.inject({
      method: 'PATCH',
      url: `/api/v1/task-center/tasks/${task.id}`,
      payload: { scheduledAt: 9999, title: '稍后处理: 新摘要' },
    });
    expect(res.json().task.scheduledAt).toBe(9999);
    expect(res.json().task.title).toBe('稍后处理: 新摘要');

    const all = await app2.inject({ method: 'GET', url: '/api/v1/task-center/tasks' });
    expect(all.json().items).toHaveLength(1);
  });

  it('re-opens a finished reminder when it is snoozed again', async () => {
    const task = await createRemind('snooze:msg-3');
    const repo = new ActionRepository(db2);
    repo.markSucceeded(task.id, repo.markRunning(task.id), { status: 'success' });

    await app2.inject({
      method: 'PATCH',
      url: `/api/v1/task-center/tasks/${task.id}`,
      payload: { scheduledAt: 12345 },
    });
    expect(repo.getById(task.id)?.queueStatus).toBe('queued');
  });

  it('cancels a task', async () => {
    const task = await createRemind('snooze:msg-4');
    await app2.inject({
      method: 'PATCH',
      url: `/api/v1/task-center/tasks/${task.id}`,
      payload: { queueStatus: 'cancelled' },
    });
    expect(new ActionRepository(db2).getById(task.id)?.queueStatus).toBe('cancelled');
  });

  it('404s on an unknown task', async () => {
    const res = await app2.inject({
      method: 'PATCH',
      url: '/api/v1/task-center/tasks/nope',
      payload: { scheduledAt: 1 },
    });
    expect(res.statusCode).toBe(404);
  });
});
