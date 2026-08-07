import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('AgentTask API', () => {
  const fetchMock = vi.fn();
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '{}',
    });
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates AgentTask OpenClaw actions with a 10 minute timeout floor', async () => {
    const idempotencyKey = 'agent-task-timeout-floor-test';
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-tasks/execute',
      payload: {
        taskId: 'agent-task-timeout-test',
        title: 'AgentTask timeout test',
        task: 'Check Jira and return a concise result.',
        executor: 'openclaw',
        timeoutMs: 1000,
        notify: false,
        idempotencyKey,
      },
    });

    expect(res.statusCode).toBe(200);

    const repo = new ActionRepository(db);
    const action = repo.findReusableByIdempotencyKey(idempotencyKey);
    expect(action).toBeTruthy();
    expect(action?.actionType).toBe('delegate_openclaw');
    expect(action?.params.timeoutMs).toBe(600000);
  });

  it('returns runtime-status from memory-service ledger preferring summary over artifact', async () => {
    const repo = new ActionRepository(db);
    const sourceRefId = 'msg_1785731886246';
    const action = repo.create({
      actionType: 'delegate_openclaw',
      title: '打开百度',
      description: '打开百度首页',
      params: {
        task: '打开百度首页',
        metadata: {
          taskId: 'agent_task_baidu',
          sheetMessageId: sourceRefId,
        },
      },
      riskLevel: 'medium',
      confidence: 0.8,
      requiresApproval: false,
      executionMode: 'auto',
      priority: 7,
      sourceKind: 'agent_task',
      sourceRefId,
      queueStatus: 'queued',
    });
    db.prepare(
      `UPDATE proposed_actions
       SET queue_status = 'succeeded',
           state = 'executed',
           finished_at = ?,
           result_json = ?
       WHERE id = ?`,
    ).run(
      Date.now(),
      JSON.stringify({
        status: 'success',
        summary: '已在 Chrome 新标签页打开 baidu.com，页面加载正常。',
        artifacts: [
          {
            kind: 'note',
            title: '百度页面已打开',
            content: 'https://www.baidu.com/ 已成功打开并读取到百度首页内容。',
          },
        ],
      }),
      action.id,
    );

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/agent-tasks/runtime-status?ids=${encodeURIComponent(sourceRefId)},missing_msg`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      items: Array<{
        sourceRefId: string;
        summary?: string;
        evidence?: { title?: string; content?: string; kind?: string };
        latestAction?: { queueStatus?: string } | null;
      }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.items[0]).toMatchObject({
      sourceRefId,
      summary: '已在 Chrome 新标签页打开 baidu.com，页面加载正常。',
      evidence: {
        kind: 'note',
        title: '百度页面已打开',
        content: 'https://www.baidu.com/ 已成功打开并读取到百度首页内容。',
      },
      latestAction: { queueStatus: 'succeeded' },
    });
    expect(body.items[1]).toMatchObject({
      sourceRefId: 'missing_msg',
      latestAction: null,
    });
  });
});
