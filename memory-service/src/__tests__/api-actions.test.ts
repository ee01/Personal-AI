import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ActionReadinessService } from '../core/ActionReadinessService.js';
import { getTestDb } from './setup.js';

describe('Action API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM action_readiness_links').run();
    db.prepare('DELETE FROM action_readiness_contracts').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  afterAll(async () => {
    await app.close();
  });

  it('locates an action by id outside the first visible list slice', async () => {
    const repo = new ActionRepository(db);
    repo.create({
      id: 'action-priority-top',
      actionType: 'notify_user',
      title: 'Visible first action',
      createdAt: 1_770_000_200,
      priority: 10,
      queueStatus: 'queued',
    });
    repo.create({
      id: 'action-deep-link-target',
      actionType: 'create_confirm_request',
      title: 'Deep link target action',
      createdAt: 1_770_000_100,
      priority: 1,
      queueStatus: 'queued',
    });

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?limit=1',
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().items.map((item: { id: string }) => item.id)).toEqual([
      'action-priority-top',
    ]);

    const directLookup = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?actionId=action-deep-link-target&limit=1',
    });
    expect(directLookup.statusCode).toBe(200);
    expect(directLookup.json()).toMatchObject({
      total: 1,
      limit: 1,
      offset: 0,
      items: [
        {
          id: 'action-deep-link-target',
          actionType: 'create_confirm_request',
          queueStatus: 'queued',
        },
      ],
    });
  });

  it('lists actions by latest activity time, not queue-status buckets', async () => {
    const repo = new ActionRepository(db);
    const olderFailed = repo.create({
      id: 'action-older-failed',
      actionType: 'delegate_agent',
      title: 'Older failed run',
      createdAt: 1_787_742_069,
      sourceKind: 'agent_task',
      sourceRefId: 'msg_sort_time',
      queueStatus: 'failed',
    });
    const newerDeadLetter = repo.create({
      id: 'action-newer-dead-letter',
      actionType: 'delegate_agent',
      title: 'Newer dead letter run',
      createdAt: 1_788_314_099,
      sourceKind: 'agent_task',
      sourceRefId: 'msg_sort_time',
      queueStatus: 'dead_letter',
    });
    db.prepare(
      `UPDATE proposed_actions
       SET started_at = ?, finished_at = ?
       WHERE id = ?`,
    ).run(1_787_742_069, 1_787_742_182, olderFailed.id);
    db.prepare(
      `UPDATE proposed_actions
       SET started_at = ?, finished_at = ?
       WHERE id = ?`,
    ).run(1_788_314_174, 1_788_314_897, newerDeadLetter.id);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?sourceKind=agent_task&sourceRefId=msg_sort_time&limit=10',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([
      'action-newer-dead-letter',
      'action-older-failed',
    ]);
  });

  it('returns readiness receipts and refuses retry while a contract is blocked', async () => {
    const repo = new ActionRepository(db);
    const action = repo.create({
      id: 'action-readiness-blocked',
      actionType: 'delegate_openclaw',
      title: '查询 Jira 发布状态',
      params: {
        task: '查询 ORB-123。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    new ActionReadinessService(db).recordDelegationOutcome(action, {
      status: 'auth_error',
      summary: 'OpenClaw authorization failed.',
      artifacts: [],
      payload: { httpStatus: 401 },
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?actionId=action-readiness-blocked',
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      readinessSummary: {
        status: 'blocked',
        blockedContractCount: 1,
      },
      items: [
        {
          id: 'action-readiness-blocked',
          readinessReceipt: {
            status: expect.stringMatching(/^blocked_/),
            dispatchState: 'dispatched',
          },
        },
      ],
    });

    const retryResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/actions/action-readiness-blocked/retry',
    });
    expect(retryResponse.statusCode).toBe(409);
    expect(retryResponse.json()).toMatchObject({
      code: 'readiness_blocked',
      readinessReceipt: {
        status: expect.stringMatching(/^blocked_/),
      },
    });
    expect(repo.getById(action.id)?.queueStatus).toBe('failed');
  });

  it('accepts a readiness probe for delegate_agent so Agent Task can be unblocked', async () => {
    const repo = new ActionRepository(db);
    repo.create({
      id: 'action-agent-task-probe',
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics',
      params: {
        task: '查询缺少 Team 的 NOVA Epics。',
        mode: 'read',
        targetSystem: 'agent_task',
      },
      sourceKind: 'agent_task',
      executionMode: 'auto',
      queueStatus: 'failed',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/actions/action-agent-task-probe/readiness/probe',
    });

    // The gate blocks every agent delegate type, so the probe must accept them
    // all; rejecting delegate_agent left blocked Agent Tasks with no way back.
    expect(response.statusCode).not.toBe(400);
    expect(response.json()).toHaveProperty('probeReceipt.probeOnly', true);
  });

  it('does not dead-letter a stale gateway run with remoteRunId on list', async () => {
    const repo = new ActionRepository(db);
    const action = repo.create({
      id: 'action-stale-remote',
      actionType: 'delegate_agent',
      title: 'Keep confirming',
      params: { task: 'long job', mode: 'read', timeoutMs: 5000 },
      executionMode: 'auto',
      queueStatus: 'queued',
    });
    repo.markRunning(action.id);
    repo.patchRunningResult(action.id, {
      status: 'running',
      remoteRunId: 'run-list-keep',
    });
    const staleStartedAt = Math.floor(Date.now() / 1000) - 800;
    db.prepare('UPDATE proposed_actions SET started_at = ? WHERE id = ?').run(
      staleStartedAt,
      action.id,
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/actions?actionId=action-stale-remote',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0]).toMatchObject({
      id: 'action-stale-remote',
      queueStatus: 'running',
    });
    expect(repo.getById(action.id)?.queueStatus).toBe('running');
  });
});
