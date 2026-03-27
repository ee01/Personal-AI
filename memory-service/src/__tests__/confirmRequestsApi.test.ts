import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../server.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { MarkdownManager } from '../core/MarkdownManager.js';

describe('Confirm Requests API', () => {
  const fetchMock = vi.fn();
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-requests-api-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    vi.spyOn(MarkdownManager.prototype, 'reindexFile').mockResolvedValue(0);

    const context = userContextManager.getContext('confirm-retry-user');
    context.db.prepare('DELETE FROM action_results').run();
    context.db.prepare('DELETE FROM topic_memory_links').run();
    context.db.prepare('DELETE FROM proposed_action_attempts').run();
    context.db.prepare('DELETE FROM proposed_actions').run();
    context.db.prepare('DELETE FROM reflection_runs').run();
    context.db.prepare('DELETE FROM dream_runs').run();
    context.db.prepare('DELETE FROM reflection_threads').run();
    context.db.prepare('DELETE FROM confirm_requests').run();
    context.db.prepare('DELETE FROM notification_records').run();
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app.close();
    userContextManager.closeAll();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('retries the linked action when an openclaw delegation confirm request is answered with retry', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const repo = new ActionRepository(context.db);
    const action = repo.create({
      id: 'action-retry-1',
      actionType: 'delegate_openclaw',
      title: '查询 Jira 进展',
      description: '在 OpenClaw 配置修复后重试查询 Jira',
      params: {
        task: '请查询 Orbit 项目的 Jira 状态',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'manual',
      queueStatus: 'failed',
      state: 'pending',
      retryCount: 1,
    });

    context.db
      .prepare(
        `INSERT INTO confirm_requests
          (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        'cr-retry-1',
        'OpenClaw 当前缺少 Jira 能力。配置完成后，是否重试？',
        '请在配置修复后重试。',
        JSON.stringify([
          { label: '配置好了，请重试', value: 'retry' },
          { label: '暂时跳过', value: 'skip_once' },
        ]),
        JSON.stringify([`action:${action.id}`]),
        'openclaw_delegation',
        'high',
        Math.floor(Date.now() / 1000),
      );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Orbit 的 Jira 状态已查询完成。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: 'Jira Summary',
                content: 'Orbit Jira status is now in progress.',
                metadata: {
                  sourceSystem: 'jira',
                  entityKey: 'ORB-123',
                  verification: 'jira_api',
                  observedFields: ['status'],
                  observedAt: '2026-03-20T08:00:00Z',
                },
              },
            ],
            payload: { jiraKey: 'ORB-123' },
          }),
        }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-retry-1/answer',
      headers: {
        'x-user-id': 'confirm-retry-user',
      },
      payload: {
        answer: 'retry',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.retriedActionId).toBe(action.id);
    expect(body.confirmRequest.state).toBe('answered');

    const updatedAction = repo.getById(action.id);
    expect(updatedAction?.queueStatus).toBe('succeeded');
    expect(updatedAction?.result?.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records skip_once without retrying the linked delegation action', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const repo = new ActionRepository(context.db);
    const action = repo.create({
      id: 'action-skip-1',
      actionType: 'delegate_openclaw',
      title: '查询 Jira 进展',
      description: '本次先不重试',
      params: {
        task: '请查询 Orbit 项目的 Jira 状态',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'manual',
      queueStatus: 'failed',
      state: 'pending',
      retryCount: 1,
    });

    context.db
      .prepare(
        `INSERT INTO confirm_requests
          (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        'cr-skip-1',
        '暂时跳过这次外部查询？',
        'OpenClaw 配置暂未修复。',
        JSON.stringify([
          { label: '暂时跳过', value: 'skip_once' },
          { label: '不再查询', value: 'stop' },
        ]),
        JSON.stringify([`action:${action.id}`]),
        'openclaw_delegation',
        'normal',
        Math.floor(Date.now() / 1000),
      );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-skip-1/answer',
      headers: {
        'x-user-id': 'confirm-retry-user',
      },
      payload: {
        answer: 'skip_once',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.skippedActionId).toBe(action.id);
    expect(body.retriedActionId).toBeUndefined();

    const updatedAction = repo.getById(action.id);
    expect(updatedAction?.queueStatus).toBe('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels the linked delegation action when answered with stop', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const repo = new ActionRepository(context.db);
    const action = repo.create({
      id: 'action-stop-1',
      actionType: 'delegate_openclaw',
      title: '停止 Jira 查询',
      description: '不再继续当前委派',
      params: {
        task: '请查询 Orbit 项目的 Jira 状态',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'manual',
      queueStatus: 'failed',
      state: 'pending',
      retryCount: 2,
    });

    context.db
      .prepare(
        `INSERT INTO confirm_requests
          (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        'cr-stop-1',
        '是否不再继续这个外部查询？',
        '当前问题暂时无需继续跟进。',
        JSON.stringify([
          { label: '暂时跳过', value: 'skip_once' },
          { label: '不再查询', value: 'stop' },
        ]),
        JSON.stringify([`action:${action.id}`]),
        'openclaw_delegation',
        'normal',
        Math.floor(Date.now() / 1000),
      );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-stop-1/answer',
      headers: {
        'x-user-id': 'confirm-retry-user',
      },
      payload: {
        answer: 'stop',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.stoppedActionId).toBe(action.id);
    expect(body.retriedActionId).toBeUndefined();

    const updatedAction = repo.getById(action.id);
    expect(updatedAction?.queueStatus).toBe('cancelled');
    expect(updatedAction?.state).toBe('dismissed');
  });

  it('wakes linked reflection threads after a confirm request is answered', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const actionRepo = new ActionRepository(context.db);
    const threadRepo = new ReflectionThreadRepository(context.db);
    const currentTime = Math.floor(Date.now() / 1000);

    const sourceThread = threadRepo.upsertThread({
      topicKey: 'confirm_request:cr-wake-1',
      title: '决策跟进: Jira Query',
      status: 'active',
      priority: 8,
      salience: 0.82,
      sourceType: 'confirm_request',
      sourceRefId: 'cr-wake-1',
      nextReflectionAt: currentTime + 3600,
      continueReason: 'waiting_for_confirm_request',
    });
    const originThread = threadRepo.upsertThread({
      topicKey: 'message:mtr-144628',
      title: '消息追踪: MTR-144628',
      status: 'active',
      priority: 9,
      salience: 0.9,
      nextReflectionAt: currentTime + 3600,
      continueReason: 'waiting_for_confirm_request',
    });

    const action = actionRepo.create({
      id: 'action-confirm-wake-1',
      actionType: 'create_confirm_request',
      title: 'Request user approval for read-only Jira query',
      description: 'Need user approval before continuing.',
      threadId: originThread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
    });
    context.db.prepare(
      `UPDATE proposed_actions
       SET queue_status = 'succeeded',
           state = 'executed',
           result_json = ?
       WHERE id = ?`,
    ).run(JSON.stringify({ confirmRequestId: 'cr-wake-1' }), action.id);

    context.db
      .prepare(
        `INSERT INTO confirm_requests
          (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        'cr-wake-1',
        'Should this Jira query proceed?',
        'Need user confirmation.',
        JSON.stringify([{ label: 'Proceed', value: 'proceed' }]),
        JSON.stringify([]),
        'reflection',
        'high',
        currentTime,
      );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-wake-1/answer',
      headers: {
        'x-user-id': 'confirm-retry-user',
      },
      payload: {
        answer: 'proceed',
      },
    });

    expect(response.statusCode).toBe(200);

    const updatedSourceThread = threadRepo.getThreadById(sourceThread.id);
    const updatedOriginThread = threadRepo.getThreadById(originThread.id);
    expect((updatedSourceThread?.nextReflectionAt ?? 0)).toBeLessThan(currentTime + 10);
    expect((updatedOriginThread?.nextReflectionAt ?? 0)).toBeLessThan(currentTime + 10);
    expect(updatedSourceThread?.continueReason).toBe('confirm request answered');
    expect(updatedOriginThread?.continueReason).toBe('confirm request answered');
  });
});
