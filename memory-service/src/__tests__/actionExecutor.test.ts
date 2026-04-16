import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { OutreachRepository } from '../repositories/OutreachRepository.js';
import { getTestDb } from './setup.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('ActionExecutor', () => {
  const fetchMock = vi.fn();
  const db = getTestDb();
  const threadRepo = new ReflectionThreadRepository(db);
  const actionRepo = new ActionRepository(db);
  const confirmRequestRepo = new ConfirmRequestRepository(db);
  const outreachRepo = new OutreachRepository(db);
  const originalRunReflection = ReflectionThreadService.prototype.runReflection;
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
    db.prepare('DELETE FROM confirm_requests').run();
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM outreach_events').run();
    db.prepare('DELETE FROM outreach_sessions').run();
    db.prepare('DELETE FROM messages_raw').run();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'action-executor-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-key',
        openClawTimeoutMs: 5000,
      }),
    );

    vi.spyOn(ReflectionThreadService.prototype, 'runReflection').mockImplementation(async function (threadId) {
      const detail = this.getThreadDetail(threadId);
      if (!detail) {
        throw new Error(`Reflection thread "${threadId}" not found`);
      }
      return {
        thread: detail.thread,
        run: detail.runs[0] ?? {
          id: 'mock-run',
          threadId,
          runType: 'action_result_followup',
          summary: 'mock rerun',
          inputRefs: [],
          discoveries: [],
          openQuestions: [],
          actions: [],
          createdAt: Math.floor(Date.now() / 1000),
        },
        actions: [],
      };
    });
  });

  afterEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    ReflectionThreadService.prototype.runReflection = originalRunReflection;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('persists action_result and rerun hook after successful delegate_openclaw execution', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 BE 进展',
      description: '查看 Orbit 项目当前的 BE 进展',
      params: {
        task: '请查询 Orbit 项目的 BE 当前进展，并返回简短总结。',
        mode: 'read',
        targetSystem: 'jira',
      },
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Orbit 的 BE 任务已推进到联调阶段。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: 'Jira Summary',
                content: 'BE in integration.',
                metadata: {
                  sourceSystem: 'jira',
                  entityKey: 'ORB-123',
                  verification: 'jira_api',
                  observedFields: ['status'],
                  observedAt: '2026-03-18T10:00:00Z',
                },
              },
            ],
            payload: { jiraKey: 'ORB-123' },
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://openclaw.example.com/v1/responses');

    const actionResults = db
      .prepare('SELECT * FROM action_results WHERE action_id = ?')
      .all(action.id) as Array<{ summary: string; transcript_path: string | null }>;
    expect(actionResults).toHaveLength(1);
    expect(actionResults[0].summary).toContain('联调阶段');
    expect(actionResults[0].transcript_path).toBeTruthy();

    const links = db
      .prepare(`SELECT * FROM topic_memory_links WHERE thread_id = ? AND source_kind = 'action_result'`)
      .all(thread.id) as Array<{ source_id: string }>;
    expect(links).toHaveLength(1);

    const updatedThread = threadRepo.getThreadById(thread.id);
    expect(updatedThread?.continueReason).toBe('new action result available');
  });

  it('syncs successful delegate_openclaw results back into outreach sessions', async () => {
    const session = outreachRepo.createSession({
      originKind: 'scheduled_template',
      channel: 'ringcentral',
      targetType: 'private',
      targetRef: 'Sophia (Jinmei) Lin',
      targetResolutionStatus: 'resolved',
      targetResolvedType: 'user',
      targetResolvedId: 'sophia.lin',
      targetResolvedLabel: 'Sophia (Jinmei) Lin',
      targetResolvedChatId: 'chat-123',
      renderedQuestion: 'Gary 的行程表有么？',
      renderedContext: '想知道 Gary 的行程有没有和 video项目相关的',
      status: 'resolved',
      sentChatId: 'chat-123',
      sentPostId: 'post-question',
      replyPostId: 'post-sophia',
      replySender: 'Sophia (Jinmei) Lin',
      replyRawText: [
        "[__Gary's calendar__](https://calendar.google.com/calendar/u/0?cid=test)",
        '1. 4/1-4/8: XMN',
        '2. 4/8-4/11: HZ',
        '你自己看，video相关应该都在下周',
        '他下周在杭州',
      ].join('\n'),
      replyClassification: 'answer',
      replyConfidence: 0.75,
      outcome: {
        classification: 'answer',
        confidence: 0.75,
        resolutionState: 'partial',
        directFindings: ['video相关应该都在下周', '他下周在杭州'],
        resolvedConclusion: 'video相关应该都在下周，Gary 下周在杭州。',
        remainingQuestions: ['需要从外部线索中核实更精确的时间或细节。'],
        candidateArtifacts: [
          {
            kind: 'link',
            title: "Gary's calendar",
            url: 'https://calendar.google.com/calendar/u/0?cid=test',
          },
        ],
        recommendedAction: 'delegate_openclaw',
        spawnedActionIds: [],
        followUpActions: [],
        delegationFailureStatus: 'error',
        delegationFailureSummary: '旧的失败信息',
        summary: '已拿到部分可用结论，系统正在继续查证更精确的细节。',
      },
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '继续查证 Gary 的 calendar',
      description: '核实 Gary 下周与 video 相关的具体安排。',
      params: {
        task: '请核实 Gary 下周与 video 相关的具体行程。',
        mode: 'read',
        targetSystem: 'calendar',
        metadata: {
          sessionId: session.id,
          replyPostId: 'post-sophia',
        },
      },
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      executionMode: 'auto',
      queueStatus: 'queued',
      confidence: 0.82,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Gary 在 4/9 有 2 个与 video 直接相关的安排：09:30-10:30 RCV project review；18:00-20:00 Dinner with Video team。',
            artifacts: [
              {
                kind: 'calendar_event',
                title: 'RCV project review',
                content: '2026-04-09 09:30-10:30，RCV project review',
                metadata: {
                  sourceSystem: 'Google Calendar',
                  entityId: 'evt-1',
                  verification: 'API直查',
                  observedFields: ['date', 'time', 'title'],
                  observedAt: '2026-04-08T03:47:39.000Z',
                },
              },
              {
                kind: 'calendar_event',
                title: 'Dinner with Video team',
                content: '2026-04-09 18:00-20:00，Dinner with Video team',
                metadata: {
                  sourceSystem: 'Google Calendar',
                  entityId: 'evt-2',
                  verification: 'API直查',
                  observedFields: ['date', 'time', 'title'],
                  observedAt: '2026-04-08T03:47:39.000Z',
                },
              },
            ],
            payload: {
              totalEvents: 10,
              videoRelated: 2,
            },
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.status).toBe('resolved');
    expect(updatedSession?.replyClassification).toBe('answer');
    expect(updatedSession?.outcome?.resolutionState).toMatch(/complete|partial/);
    expect(String(updatedSession?.outcome?.resolvedConclusion)).toContain('4/9');
    expect(String(updatedSession?.outcome?.externalSummary)).toContain('Dinner with Video team');
    expect(Array.isArray(updatedSession?.outcome?.externalEvidence)).toBe(true);
    expect(updatedSession?.outcome?.spawnedActionIds).toContain(action.id);
    expect(updatedSession?.outcome?.delegationFailureStatus).toBeUndefined();
    expect(updatedSession?.outcome?.delegationFailureSummary).toBeUndefined();
    expect(updatedSession?.outcome?.followUpActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: action.id,
          queueStatus: 'succeeded',
        }),
      ]),
    );

    const resolvedEvents = outreachRepo
      .listEventsBySession(session.id, 20)
      .filter((event) => event.eventType === 'resolved');
    expect(resolvedEvents.length).toBeGreaterThanOrEqual(1);
    expect(String(resolvedEvents[resolvedEvents.length - 1]?.payload?.externalSummary)).toContain('RCV project review');
  });

  it('syncs failed delegate_openclaw results back into outreach sessions', async () => {
    const session = outreachRepo.createSession({
      originKind: 'scheduled_template',
      channel: 'ringcentral',
      targetType: 'private',
      targetRef: 'Sophia (Jinmei) Lin',
      targetResolutionStatus: 'resolved',
      targetResolvedType: 'user',
      targetResolvedId: 'sophia.lin',
      targetResolvedLabel: 'Sophia (Jinmei) Lin',
      targetResolvedChatId: 'chat-123',
      renderedQuestion: 'Gary 的行程表有么？',
      renderedContext: '想知道 Gary 的行程有没有和 video项目相关的',
      status: 'resolved',
      sentChatId: 'chat-123',
      sentPostId: 'post-question',
      replyPostId: 'post-sophia',
      replySender: 'Sophia (Jinmei) Lin',
      replyRawText: '他下周在杭州，video相关应该都在下周。',
      replyClassification: 'answer',
      replyConfidence: 0.75,
      outcome: {
        classification: 'answer',
        confidence: 0.75,
        resolutionState: 'partial',
        directFindings: ['他下周在杭州', 'video相关应该都在下周。'],
        resolvedConclusion: 'Gary 下周在杭州，video 相关安排大概率也在下周。',
        remainingQuestions: ['需要从外部线索中核实更精确的时间或细节。'],
        recommendedAction: 'delegate_openclaw',
        spawnedActionIds: [],
        followUpActions: [],
        summary: '已拿到部分可用结论，系统正在继续查证更精确的细节。',
      },
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '继续查证 Gary 的 calendar',
      description: '核实 Gary 下周与 video 相关的具体安排。',
      params: {
        task: '请核实 Gary 下周与 video 相关的具体行程。',
        mode: 'read',
        targetSystem: 'calendar',
      },
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      executionMode: 'auto',
      queueStatus: 'queued',
      confidence: 0.82,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'capability_missing',
            summary: '无法直接访问 Gary 的 Google Calendar，需要额外认证。',
            payload: {
              question: '需要访问 Gary 的 Google Calendar 权限才能核实具体 video 项目日程。',
            },
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('failed');

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.status).toBe('resolved');
    expect(updatedSession?.outcome?.resolutionState).toBe('partial');
    expect(String(updatedSession?.outcome?.delegationFailureSummary)).toContain('Google Calendar');
    expect(String(updatedSession?.outcome?.resolvedConclusion)).toContain('外部查证暂未成功');
    expect(updatedSession?.outcome?.followUpActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: action.id,
          queueStatus: 'failed',
        }),
      ]),
    );

    const resolvedEvents = outreachRepo
      .listEventsBySession(session.id, 20)
      .filter((event) => event.eventType === 'resolved');
    expect(resolvedEvents.length).toBeGreaterThanOrEqual(1);
    expect(String(resolvedEvents[resolvedEvents.length - 1]?.payload?.delegationFailureSummary)).toContain('Google Calendar');
  });

  it('does not repeatedly append the same delegation failure suffix into outreach conclusions', async () => {
    const session = outreachRepo.createSession({
      originKind: 'scheduled_template',
      channel: 'ringcentral',
      targetType: 'private',
      targetRef: 'Sophia (Jinmei) Lin',
      renderedQuestion: 'Gary 的行程表有么？',
      renderedContext: '想知道 Gary 的行程有没有和 video项目相关的',
      status: 'resolved',
      sentChatId: 'chat-123',
      sentPostId: 'post-question',
      replyPostId: 'post-sophia',
      replySender: 'Sophia (Jinmei) Lin',
      replyRawText: '他下周在杭州，video相关应该都在下周。',
      replyClassification: 'answer',
      replyConfidence: 0.75,
      outcome: {
        classification: 'answer',
        confidence: 0.75,
        resolutionState: 'partial',
        directFindings: ['他下周在杭州', 'video相关应该都在下周。'],
        resolvedConclusion: 'Gary 下周在杭州，video 相关安排大概率也在下周。；但外部查证暂未成功：旧错误',
        remainingQuestions: ['需要从外部线索中核实更精确的时间或细节。'],
        recommendedAction: 'delegate_openclaw',
        spawnedActionIds: [],
        followUpActions: [],
      },
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '继续查证 Gary 的 calendar',
      description: '核实 Gary 下周与 video 相关的具体安排。',
      params: {
        task: '请核实 Gary 下周与 video 相关的具体行程。',
        mode: 'read',
        targetSystem: 'calendar',
      },
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      executionMode: 'auto',
      queueStatus: 'queued',
      confidence: 0.82,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'capability_missing',
            summary: '无法直接访问 Gary 的 Google Calendar，需要额外认证。',
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    await executor.executeAction(action.id);

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(String(updatedSession?.outcome?.resolvedConclusion)).toBe(
      'Gary 下周在杭州，video 相关安排大概率也在下周。；但外部查证暂未成功：无法直接访问 Gary 的 Google Calendar，需要额外认证。',
    );
  });

  it('creates confirm request and notification follow-ups for capability_missing delegation outcome', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 Jira 状态',
      description: '尝试查询 Jira，但当前 OpenClaw 可能没有对应能力',
      params: {
        task: '请查询 Orbit 项目的 Jira 任务状态。',
        mode: 'read',
        targetSystem: 'jira',
      },
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
      priority: 9,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'capability_missing',
            summary: 'OpenClaw 当前未配置 Jira 相关能力。',
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('failed');
    expect(result.error).toContain('未配置 Jira');

    const confirmRequests = db
      .prepare(`SELECT * FROM confirm_requests WHERE category = 'openclaw_delegation'`)
      .all() as Array<{ question: string; options_json: string; evidence_refs_json: string }>;
    expect(confirmRequests).toHaveLength(1);
    expect(confirmRequests[0].question).toContain('是否重试');
    expect(confirmRequests[0].evidence_refs_json).toContain(action.id);

    const notifications = db
      .prepare(`SELECT * FROM notification_records WHERE channel = 'reflection_action'`)
      .all() as Array<{ title: string; body: string }>;
    expect(notifications).toHaveLength(2);
    expect(notifications.some((item) => item.title.includes('缺少能力'))).toBe(true);
    expect(notifications.some((item) => item.body.includes('Jira'))).toBe(true);
    expect(notifications.some((item) => item.title.includes('需要确认'))).toBe(true);

    const followUpActions = db
      .prepare(
        `SELECT action_type, queue_status
         FROM proposed_actions
         WHERE source_kind = 'delegation_recovery'`,
      )
      .all() as Array<{ action_type: string; queue_status: string }>;
    expect(followUpActions.length).toBeGreaterThanOrEqual(2);
    expect(followUpActions.some((item) => item.action_type === 'notify_user')).toBe(true);
    expect(followUpActions.some((item) => item.action_type === 'create_confirm_request')).toBe(true);
  });

  it('alerts immediately when a high-priority confirm request is created', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 9,
      salience: 0.82,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'create_confirm_request',
      title: '需要确认是否升级发布窗口',
      description: '发布风险上升，需要你确认是否调整发布时间。',
      params: {
        question: '是否将 Orbit 的发布时间顺延一天？',
        context: '当前回归问题尚未完全关闭。',
        options: [
          { label: '顺延一天', value: 'delay_1d' },
          { label: '保持原计划', value: 'keep' },
        ],
        category: 'release',
        priority: 'high',
      },
      threadId: thread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
      priority: 9,
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
      json: async () => ({ ok: true }),
    });
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.confirmRequestId).toBeTruthy();
    expect(result.result?.alertActionId).toBeTruthy();

    const confirmRequests = db
      .prepare(`SELECT * FROM confirm_requests WHERE id = ?`)
      .all(String(result.result?.confirmRequestId)) as Array<{ priority: string; question: string }>;
    expect(confirmRequests).toHaveLength(1);
    expect(confirmRequests[0].priority).toBe('high');
    expect(confirmRequests[0].question).toContain('是否将 Orbit 的发布时间顺延一天');

    const alertAction = db
      .prepare(`SELECT * FROM proposed_actions WHERE id = ?`)
      .get(String(result.result?.alertActionId)) as
      | { action_type: string; source_kind: string; queue_status: string }
      | undefined;
    expect(alertAction).toMatchObject({
      action_type: 'notify_user',
      source_kind: 'confirm_request_alert',
      queue_status: 'succeeded',
    });

    const notifications = db
      .prepare(`SELECT * FROM notification_records WHERE payload_json LIKE ?`)
      .all(`%${String(result.result?.confirmRequestId)}%`) as Array<{ title: string; body: string }>;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain('需要确认');
  });

  it('reuses an existing pending confirm request instead of creating a duplicate', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 9,
      salience: 0.82,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const existing = confirmRequestRepo.createOrReusePending({
      id: 'cr-existing',
      question: '请求用户确认已收到通知',
      context: '确保用户已收到并理解风险通知，减少遗漏和误解。',
      options: [
        { label: '已收到', value: 'received' },
        { label: '未收到', value: 'not_received' },
      ],
      category: 'reflection',
      priority: 'normal',
      createdAt: Math.floor(Date.now() / 1000),
    });
    const existingAction = actionRepo.create({
      actionType: 'create_confirm_request',
      title: '请求用户确认已收到通知',
      threadId: thread.id,
      runId: 'run-existing',
      executionMode: 'auto',
      queueStatus: 'succeeded',
      createdAt: Math.floor(Date.now() / 1000),
    });
    db.prepare('UPDATE proposed_actions SET result_json = ? WHERE id = ?').run(
      JSON.stringify({ confirmRequestId: 'cr-existing' }),
      existingAction.id,
    );

    const action = actionRepo.create({
      actionType: 'create_confirm_request',
      title: '请求用户确认已收到通知',
      description: 'Project Orbit 的风险推送已经发出。',
      params: {
        question: '请求用户确认已收到通知',
        context: '确保用户已知晓风险并理解下一步建议，降低沟通遗漏风险。',
        options: [
          { label: '已收到', value: 'received' },
          { label: '未收到', value: 'not_received' },
        ],
        category: 'reflection',
        priority: 'high',
      },
      threadId: thread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
      priority: 9,
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(existing.created).toBe(true);
    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.confirmRequestId).toBe('cr-existing');
    expect(result.result?.reusedExisting).toBe(true);
    expect(result.result?.alertActionId).toBeUndefined();

    const requests = db
      .prepare(`SELECT id, priority FROM confirm_requests ORDER BY created_at ASC`)
      .all() as Array<{ id: string; priority: string }>;
    expect(requests).toEqual([{ id: 'cr-existing', priority: 'high' }]);
  });

  it('executes due auto delegate_openclaw write actions when approval is not required', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '在 Jira 中更新发布状态',
      description: '尝试直接写入外部系统',
      params: {
        task: '请将 Orbit 项目的发布状态更新为 blocked。',
        mode: 'write',
        targetSystem: 'jira',
      },
      threadId: thread.id,
      executionMode: 'auto',
      requiresApproval: false,
      queueStatus: 'queued',
      scheduledAt: Math.floor(Date.now() / 1000) - 1,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Jira 发布状态已更新为 blocked。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: 'Jira 更新结果',
                content: 'Orbit 发布状态已改为 blocked。',
                metadata: {
                  sourceSystem: 'jira',
                  entityKey: 'ORB-123',
                  verification: 'jira_api',
                  operation: 'update_status',
                  changedFields: ['status'],
                  updatedAt: '2026-04-16T03:00:00Z',
                },
              },
            ],
            payload: { targetSystem: 'jira', status: 'blocked' },
          }),
        }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const [result] = await executor.runDueActions(10);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const updated = actionRepo.getById(action.id);
    expect(updated?.queueStatus).toBe('succeeded');
  });

  it('rejects delegate_openclaw actions that still require approval when forced into auto execution', async () => {
    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '异常的自动审批配置',
      description: '验证安全兜底',
      params: {
        task: '请直接写入外部系统。',
        mode: 'write',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      requiresApproval: true,
      queueStatus: 'queued',
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('failed');
    expect(result.error).toContain('需要审批');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not auto-rerun reflection after action_result when reflection is disabled for the user', async () => {
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        reflectionEnabled: false,
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-key',
        openClawTimeoutMs: 5000,
      }),
    );

    const thread = threadRepo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询外部状态',
      description: '验证关闭自我反思时不会自动 rerun',
      params: {
        task: '请简单返回一条成功消息。',
        mode: 'read',
        targetSystem: 'test',
      },
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '外部查询成功。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: '验证结果',
                content: '外部系统返回成功。',
                metadata: {
                  sourceSystem: 'test',
                  entityKey: 'resource-1',
                  verification: 'integration_test',
                  observedFields: ['status'],
                  observedAt: '2026-03-18T10:00:00Z',
                },
              },
            ],
          }),
        }),
    });

    const runSpy = vi.spyOn(ReflectionThreadService.prototype, 'runReflection');
    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('creates a confirm request instead of an outreach session when outreach is disabled', async () => {
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        outreachEnabled: false,
        ringCentralServerUrl: '',
        ringCentralClientId: '',
        ringCentralClientSecretConfigured: false,
        ringCentralJwtConfigured: false,
      }),
    );

    const thread = threadRepo.upsertThread({
      topicKey: 'project:outreach-disabled',
      title: '项目反思: Outreach disabled',
      status: 'active',
      priority: 8,
      salience: 0.88,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'ask_external_user',
      title: '询问 AI Service 当前版本号',
      description: '当前 release 版本号是多少？',
      params: {
        targetType: 'private',
        targetRef: 'AI Service',
        question: '当前 release 版本号是多少？',
      },
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
      priority: 8,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
      json: async () => ({ ok: true }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.status).toBe('blocked');
    expect(result.result?.blockReason).toBe('disabled');
    expect(result.result?.confirmRequestId).toBeTruthy();

    const confirmRequest = db
      .prepare(`SELECT question, category FROM confirm_requests WHERE id = ?`)
      .get(String(result.result?.confirmRequestId)) as { question: string; category: string } | undefined;
    expect(confirmRequest?.category).toBe('outreach_setup');
    expect(confirmRequest?.question).toContain('主动询问引擎尚未开启');

    const sessionCount = (db
      .prepare(`SELECT COUNT(*) AS count FROM outreach_sessions`)
      .get() as { count: number }).count;
    expect(sessionCount).toBe(0);
  });

  it('routes self-targeted ask_external_user actions back to confirm request instead of outreach', async () => {
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        outreachEnabled: true,
        ringCentralServerUrl: 'https://platform.ringcentral.example.com',
        ringCentralClientId: 'client-id',
        ringCentralClientSecret: 'client-secret',
        ringCentralJwt: 'jwt-token',
      }),
    );

    const thread = threadRepo.upsertThread({
      topicKey: 'project:outreach-self-target',
      title: '项目反思: Outreach self target',
      status: 'active',
      priority: 8,
      salience: 0.88,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });

    const action = actionRepo.create({
      actionType: 'ask_external_user',
      title: '让我自己去确认版本号',
      description: '当前 release 版本号是多少？',
      params: {
        targetType: 'person',
        targetRef: 'user',
        question: '当前 release 版本号是多少？',
      },
      threadId: thread.id,
      executionMode: 'manual',
      queueStatus: 'queued',
      priority: 8,
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
      json: async () => ({ ok: true }),
    });

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.status).toBe('blocked');
    expect(result.result?.blockReason).toBe('self_target');
    expect(result.result?.confirmRequestId).toBeTruthy();

    const confirmRequest = db
      .prepare(`SELECT question, category FROM confirm_requests WHERE id = ?`)
      .get(String(result.result?.confirmRequestId)) as { question: string; category: string } | undefined;
    expect(confirmRequest?.category).toBe('outreach_target_review');
    expect(confirmRequest?.question).toContain('目标是你自己');

    const sessionCount = (db
      .prepare(`SELECT COUNT(*) AS count FROM outreach_sessions`)
      .get() as { count: number }).count;
    expect(sessionCount).toBe(0);
  });
});
