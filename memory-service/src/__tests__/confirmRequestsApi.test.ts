import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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
    context.db
      .prepare(
        `UPDATE proposed_actions
       SET queue_status = 'succeeded',
           state = 'executed',
           result_json = ?
       WHERE id = ?`,
      )
      .run(JSON.stringify({ confirmRequestId: 'cr-wake-1' }), action.id);

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
    expect(updatedSourceThread?.nextReflectionAt ?? 0).toBeLessThan(
      currentTime + 10,
    );
    expect(updatedOriginThread?.nextReflectionAt ?? 0).toBeLessThan(
      currentTime + 10,
    );
    expect(updatedSourceThread?.continueReason).toBe(
      'confirm request answered',
    );
    expect(updatedOriginThread?.continueReason).toBe(
      'confirm request answered',
    );
  });

  it('filters confirm requests by queue and excludes watch items from decision queue', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const currentTime = Math.floor(Date.now() / 1000);

    context.db
      .prepare(
        `INSERT INTO confirm_requests
        (id, question, options_json, evidence_refs_json, category, priority, state, routing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'cr-decision-1',
        'Should we proceed with Orbit migration?',
        JSON.stringify([{ label: 'Proceed', value: 'proceed' }]),
        JSON.stringify([]),
        'reflection',
        'high',
        'pending',
        'decision',
        currentTime,
        currentTime,
      );

    context.db
      .prepare(
        `INSERT INTO confirm_requests
        (id, question, options_json, evidence_refs_json, category, priority, state, routing, reason_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'cr-watch-1',
        'Will AI Notes Edit BE change next week?',
        JSON.stringify([{ label: '继续观察', value: 'continue' }]),
        JSON.stringify([]),
        'evidence_resolution',
        'normal',
        'snoozed',
        'watch',
        'future_monitoring',
        currentTime,
        currentTime,
      );

    const decisionResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/confirm-requests?queue=decision&state=pending',
      headers: { 'x-user-id': 'confirm-retry-user' },
    });
    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json().items.map((item: any) => item.id)).toEqual([
      'cr-decision-1',
    ]);

    const watchResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/confirm-requests?queue=watch&state=snoozed',
      headers: { 'x-user-id': 'confirm-retry-user' },
    });
    expect(watchResponse.statusCode).toBe(200);
    expect(watchResponse.json().items.map((item: any) => item.id)).toEqual([
      'cr-watch-1',
    ]);
  });

  it('transitions watch item state through the state endpoint and rejects answer endpoint', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const currentTime = Math.floor(Date.now() / 1000);

    context.db
      .prepare(
        `INSERT INTO confirm_requests
        (id, question, options_json, evidence_refs_json, category, priority, state, routing, reason_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'cr-watch-transition',
        'Who owns Orbit now?',
        JSON.stringify([{ label: '继续观察', value: 'continue' }]),
        JSON.stringify([]),
        'evidence_resolution',
        'normal',
        'snoozed',
        'watch',
        'owner_eta_gap',
        currentTime,
        currentTime,
      );

    const answerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-watch-transition/answer',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { answer: 'continue' },
    });
    expect(answerResponse.statusCode).toBe(400);

    const stateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-watch-transition/state',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { state: 'pending' },
    });
    expect(stateResponse.statusCode).toBe(200);
    expect(stateResponse.json().confirmRequest.state).toBe('pending');
    expect(stateResponse.json().queuedActionId).toBeTruthy();

    const queuedAction = context.db
      .prepare(
        `SELECT action_type, source_kind, source_ref_id FROM proposed_actions WHERE id = ?`,
      )
      .get(stateResponse.json().queuedActionId) as {
      action_type: string;
      source_kind: string | null;
      source_ref_id: string | null;
    };
    expect(queuedAction).toMatchObject({
      action_type: 'delegate_openclaw',
      source_kind: 'confirm_request_watch',
      source_ref_id: 'cr-watch-transition',
    });

    const resnoozeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/cr-watch-transition/state',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { state: 'snoozed' },
    });
    expect(resnoozeResponse.statusCode).toBe(200);
    expect(resnoozeResponse.json().confirmRequest.state).toBe('snoozed');
  });

  it('reclassifies legacy evidence-resolution confirm requests through the admin endpoint', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const currentTime = Math.floor(Date.now() / 1000);

    context.db
      .prepare(
        `INSERT INTO confirm_requests
        (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'cr-legacy-1',
        'AI Notes Edit BE 的具体进展情况是什么？',
        '目前未检索到直接信息，建议向负责人确认后续安排。',
        JSON.stringify([{ label: '继续查证', value: 'continue' }]),
        JSON.stringify([]),
        'evidence_resolution',
        'normal',
        'pending',
        currentTime,
        currentTime,
      );
    context.db
      .prepare(
        `INSERT INTO confirm_requests
        (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'cr-legacy-2',
        'AI Notes edit功能BE的具体开发计划、负责人及时间表尚未明确。',
        '整体项目在推进，但 edit 相关 BE 负责人和时间表仍缺失。',
        JSON.stringify([{ label: '继续查证', value: 'continue' }]),
        JSON.stringify([]),
        'evidence_resolution',
        'normal',
        'pending',
        currentTime + 1,
        currentTime + 1,
      );

    const dryRunResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/reclassify-legacy',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { dryRun: true, limit: 10 },
    });
    expect(dryRunResponse.statusCode).toBe(200);
    expect(dryRunResponse.json().summary.scanned).toBeGreaterThanOrEqual(1);
    expect(dryRunResponse.json().summary.updated).toBe(0);

    const applyResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/reclassify-legacy',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { dryRun: false, limit: 10 },
    });
    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.json().summary.updated).toBeGreaterThanOrEqual(1);

    const reclassified = context.db
      .prepare(
        `SELECT routing, state, reason_code, source_anchor, gap_type
         FROM confirm_requests
         WHERE id = ?`,
      )
      .get('cr-legacy-1') as {
      routing: string | null;
      state: string;
      reason_code: string | null;
      source_anchor: string | null;
      gap_type: string | null;
    };
    expect(reclassified).toMatchObject({
      routing: 'watch',
      state: 'snoozed',
      reason_code: 'owner_eta_gap',
      gap_type: 'owner_eta',
    });
    expect(reclassified.source_anchor).toMatch(/^topic:/);

    const deduped = context.db
      .prepare(`SELECT state, source_anchor FROM confirm_requests WHERE id = ?`)
      .get('cr-legacy-2') as {
      state: string;
      source_anchor: string | null;
    };
    expect(deduped.source_anchor).toBe(reclassified.source_anchor);
    expect(deduped.state).toBe('deduplicated');
  });

  it('prefers entity_property anchors over entity anchors during legacy reclassification', async () => {
    const context = userContextManager.getContext('confirm-retry-user');
    const currentTime = Math.floor(Date.now() / 1000) + 100;

    const insertLegacy = context.db.prepare(
      `INSERT INTO confirm_requests
      (id, question, context, options_json, evidence_refs_json, category, priority, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    insertLegacy.run(
      'cr-legacy-property-1',
      'Alpha 项目的 owner 和上线时间是什么？',
      '目前缺少 owner 和发布时间。',
      JSON.stringify([{ label: '继续查证', value: 'continue' }]),
      JSON.stringify(['entity:project-alpha', 'entity_property:9001']),
      'evidence_resolution',
      'normal',
      'pending',
      currentTime,
      currentTime,
    );
    insertLegacy.run(
      'cr-legacy-property-2',
      'Alpha 项目的 owner 和排期是否已经明确？',
      '该项目另一个属性仍缺少 owner 和排期。',
      JSON.stringify([{ label: '继续查证', value: 'continue' }]),
      JSON.stringify(['entity:project-alpha', 'entity_property:9002']),
      'evidence_resolution',
      'normal',
      'pending',
      currentTime + 1,
      currentTime + 1,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/confirm-requests/reclassify-legacy',
      headers: { 'x-user-id': 'confirm-retry-user' },
      payload: { dryRun: false, limit: 20 },
    });
    expect(response.statusCode).toBe(200);

    const rows = context.db
      .prepare(
        `SELECT id, state, source_anchor, gap_type
         FROM confirm_requests
         WHERE id IN ('cr-legacy-property-1', 'cr-legacy-property-2')
         ORDER BY id ASC`,
      )
      .all() as Array<{
      id: string;
      state: string;
      source_anchor: string | null;
      gap_type: string | null;
    }>;

    expect(rows).toEqual([
      {
        id: 'cr-legacy-property-1',
        state: 'snoozed',
        source_anchor: 'entity_property:9001',
        gap_type: 'owner_eta',
      },
      {
        id: 'cr-legacy-property-2',
        state: 'snoozed',
        source_anchor: 'entity_property:9002',
        gap_type: 'owner_eta',
      },
    ]);
  });
});
