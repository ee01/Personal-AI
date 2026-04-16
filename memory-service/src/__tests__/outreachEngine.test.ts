import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { OutreachEngine } from '../core/OutreachEngine.js';
import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { RingCentralClient } from '../integrations/RingCentralClient.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { OutreachRepository } from '../repositories/OutreachRepository.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

describe('OutreachEngine', () => {
  const db = getTestDb();
  const fetchMock = vi.fn();
  const threadRepo = new ReflectionThreadRepository(db);
  const actionRepo = new ActionRepository(db);
  const outreachRepo = new OutreachRepository(db);
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    db.prepare('DELETE FROM outreach_events').run();
    db.prepare('DELETE FROM outreach_sessions').run();
    db.prepare('DELETE FROM outreach_templates').run();
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
    db.prepare('DELETE FROM confirm_requests').run();
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM messages_raw').run();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-engine-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        outreachEnabled: true,
        outreachIntervalMs: 60000,
        outreachRequireApprovalForReflection: false,
        outreachRequireApprovalForManual: false,
        reflectionEnabled: false,
        ringCentralServerUrl: 'https://platform.ringcentral.example.com',
        ringCentralClientId: 'client-id',
        ringCentralClientSecret: 'client-secret',
        ringCentralJwt: 'jwt-token',
      }),
    );
  });

  afterEach(() => {
    RingCentralClient.clearSharedCacheForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function mockRingCentralSend(chatId = 'chat-123', postId = 'post-123') {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (
        url.includes(
          `/team-messaging/v1/chats/${encodeURIComponent(chatId)}/posts`,
        )
      ) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: postId }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
  }

  function mockRingCentralListPosts(
    chatId: string,
    records: Array<Record<string, unknown>>,
  ) {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (url.endsWith('/restapi/v1.0/account/~/extension/~')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: 'self-ext-1',
              name: 'Esone Qiu',
              contact: {
                firstName: 'Esone',
                lastName: 'Qiu',
                email: 'test-user@ringcentral.com',
              },
            }),
        };
      }
      if (
        url.includes(
          `/team-messaging/v1/chats/${encodeURIComponent(chatId)}/posts?`,
        )
      ) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ records }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
  }

  it('bridges ask_external_user action execution into an outreach session', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:outreach',
      title: '项目反思: Outreach',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });
    const action = actionRepo.create({
      actionType: 'ask_external_user',
      title: '询问外部负责人',
      description: '询问测试窗口是否锁定',
      params: {
        targetType: 'group',
        targetRef: 'chat-123',
        question: '测试窗口是否已经锁定？',
        context: '如果未锁定，需要知道预计完成时间。',
        maxFollowup: 1,
        followupIntervalSeconds: 3600,
      },
      threadId: thread.id,
      runId: 'run-1',
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    mockRingCentralSend();

    const executor = new ActionExecutor(db, userDataManager, 'test-user');
    const result = await executor.executeAction(action.id);

    expect(result.queueStatus).toBe('succeeded');
    expect(result.result?.outreachSessionId).toBeTruthy();
    expect(result.result?.sessionStatus).toBe('waiting_reply');

    const session = outreachRepo.getSessionByActionId(action.id);
    expect(session?.status).toBe('waiting_reply');
    expect(session?.sentChatId).toBe('chat-123');
    expect(session?.sentPostId).toBe('post-123');

    const messages = db
      .prepare(
        `SELECT source_type, content FROM messages_raw WHERE source_type = 'outreach_question'`,
      )
      .all() as Array<{ source_type: string; content: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toContain('测试窗口是否已经锁定');
  });

  it('marks reflection outreach resolved and writes action_result after reply arrives', async () => {
    const thread = threadRepo.upsertThread({
      topicKey: 'project:outreach-reply',
      title: '项目反思: Outreach Reply',
      status: 'active',
      priority: 8,
      salience: 0.9,
      nextReflectionAt: Math.floor(Date.now() / 1000),
    });
    const action = actionRepo.create({
      actionType: 'ask_external_user',
      title: '追问时间',
      params: {
        targetType: 'group',
        targetRef: 'chat-abc',
        question: '能否给出 ETA？',
      },
      threadId: thread.id,
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    const session = outreachRepo.createSession({
      originKind: 'reflection_action',
      actionId: action.id,
      threadId: thread.id,
      targetType: 'group',
      targetRef: 'chat-abc',
      renderedQuestion: '能否给出 ETA？',
      status: 'waiting_reply',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-abc',
      sentPostId: 'post-seed',
      nextCheckAt: Math.floor(Date.now() / 1000) - 5,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (
        url.includes(
          `/team-messaging/v1/chats/${encodeURIComponent('chat-abc')}/posts?`,
        )
      ) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'reply-1',
                  text: '预计今天 18:00 前完成并同步给你。',
                  creator: { id: 'user-42' },
                  creationTime: '2026-03-19T07:00:00Z',
                },
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.status).toBe('resolved');
    expect(updatedSession?.replyPostId).toBe('reply-1');
    expect(updatedSession?.replyClassification).toBe('answer');

    const actionResults = db
      .prepare(
        'SELECT action_id, result_type, summary FROM action_results WHERE action_id = ?',
      )
      .all(action.id) as Array<{
      action_id: string;
      result_type: string;
      summary: string;
    }>;
    expect(actionResults).toHaveLength(1);
    expect(actionResults[0].result_type).toBe('resolved');
    expect(actionResults[0].summary).toBeTruthy();
    expect(actionResults[0].summary).toContain('18:00');
  });

  it('combines reply bursts, keeps the known answer, and queues external delegation for missing details', async () => {
    const session = outreachRepo.createSession({
      originKind: 'scheduled_template',
      targetType: 'private',
      targetRef: 'sophia.lin',
      renderedQuestion: 'Gary 的行程表有么？',
      renderedContext: '想知道 Gary 的行程有没有和 video 项目相关的',
      status: 'waiting_reply',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-multi',
      sentPostId: 'post-seed',
      replyPostId: 'reply-old',
      replyRawText: '好',
      replyClassification: 'unclear',
      replyConfidence: 0.35,
      lastPollAt: Math.floor(Date.now() / 1000) - 60,
      nextCheckAt: Math.floor(Date.now() / 1000) - 5,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
    });

    mockRingCentralListPosts('chat-multi', [
      {
        id: 'reply-4',
        text: '他下周在杭州',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:10Z',
      },
      {
        id: 'reply-3',
        text: '你自己看，video相关应该都在下周',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:05Z',
      },
      {
        id: 'reply-2',
        text: "[Gary's calendar](https://calendar.example.com/gary)",
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:00Z',
      },
      {
        id: 'reply-old',
        text: '好',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:30:00Z',
      },
    ]);

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.status).toBe('resolved');
    expect(updatedSession?.replyPostId).toBe('reply-4');
    expect(updatedSession?.replySender).toBe('Sophia (Jinmei) Lin');
    expect(updatedSession?.replyRawText).toBe(
      "[Gary's calendar](https://calendar.example.com/gary)\n你自己看，video相关应该都在下周\n他下周在杭州",
    );
    expect(updatedSession?.replyClassification).toBe('answer');
    expect(updatedSession?.outcome?.resolutionState).toBe('partial');
    expect(String(updatedSession?.outcome?.resolvedConclusion)).toContain(
      'video相关应该都在下周',
    );
    expect(updatedSession?.outcome?.spawnedActionIds).toHaveLength(1);

    const replyEvents = outreachRepo
      .listEventsBySession(session.id, 20)
      .filter((event) => event.eventType === 'reply_received');
    expect(replyEvents).toHaveLength(1);
    expect(replyEvents[0].payload?.replyPostIds).toEqual([
      'reply-2',
      'reply-3',
      'reply-4',
    ]);

    const replyMessages = db
      .prepare(
        `SELECT content FROM messages_raw WHERE source_type = 'outreach_reply' ORDER BY timestamp ASC`,
      )
      .all() as Array<{ content: string }>;
    expect(replyMessages).toHaveLength(1);
    expect(replyMessages[0].content).toContain('video相关应该都在下周');

    const followUpActions = actionRepo.list({
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      limit: 10,
    }).items;
    expect(followUpActions).toHaveLength(1);
    expect(followUpActions[0].actionType).toBe('delegate_openclaw');
    expect(followUpActions[0].executionMode).toBe('auto');
    expect(followUpActions[0].params.mode).toBe('read');
  });

  it('does not re-process an already recorded reply burst on later polls', async () => {
    const session = outreachRepo.createSession({
      originKind: 'manual_action',
      targetType: 'private',
      targetRef: 'sophia.lin',
      renderedQuestion: '请问有更新吗？',
      status: 'waiting_reply',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-dedupe',
      sentPostId: 'post-seed',
      replyPostId: 'reply-3',
      replyRawText: '你自己看，video相关应该都在下周',
      replyClassification: 'answer',
      replyConfidence: 0.72,
      lastPollAt: Math.floor(Date.now() / 1000) - 60,
      nextCheckAt: Math.floor(Date.now() / 1000) - 5,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
    });
    outreachRepo.createEvent(session.id, 'reply_received', {
      replyPostId: 'reply-3',
      replyPostIds: ['reply-2', 'reply-3'],
      classification: 'answer',
      confidence: 0.72,
    });

    mockRingCentralListPosts('chat-dedupe', [
      {
        id: 'reply-2',
        text: "[Gary's calendar](https://calendar.example.com/gary)",
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:00Z',
      },
      {
        id: 'reply-3',
        text: '你自己看，video相关应该都在下周',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:05Z',
      },
    ]);

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const replyEvents = outreachRepo
      .listEventsBySession(session.id, 20)
      .filter((event) => event.eventType === 'reply_received');
    expect(replyEvents).toHaveLength(1);

    const replyMessages = db
      .prepare(
        `SELECT content FROM messages_raw WHERE source_type = 'outreach_reply'`,
      )
      .all() as Array<{ content: string }>;
    expect(replyMessages).toHaveLength(0);
  });

  it('ignores self-authored follow-up posts when picking the latest external reply', async () => {
    const session = outreachRepo.createSession({
      originKind: 'manual_action',
      targetType: 'private',
      targetRef: 'sophia.lin',
      renderedQuestion: 'Gary 的行程表有么？',
      renderedContext: '想知道 Gary 的行程有没有和 video 项目相关的',
      status: 'waiting_reply',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-ignore-self',
      sentPostId: 'post-seed',
      lastPollAt: Math.floor(Date.now() / 1000) - 60,
      nextCheckAt: Math.floor(Date.now() / 1000) - 5,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
    });

    mockRingCentralListPosts('chat-ignore-self', [
      {
        id: 'reply-self-1',
        text: '哈哈，别慌，最差 google sheet 还有历史记录功能',
        creator: { name: 'Esone Qiu' },
        creationTime: '2026-04-01T02:43:10Z',
      },
      {
        id: 'reply-4',
        text: '他下周在杭州',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:10Z',
      },
      {
        id: 'reply-3',
        text: '你自己看，video相关应该都在下周',
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:05Z',
      },
      {
        id: 'reply-2',
        text: "[Gary's calendar](https://calendar.example.com/gary)",
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:00Z',
      },
    ]);

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.replyPostId).toBe('reply-4');
    expect(updatedSession?.replySender).toBe('Sophia (Jinmei) Lin');
    expect(updatedSession?.replyRawText).toContain('video相关应该都在下周');
    expect(updatedSession?.replyRawText).not.toContain('哈哈，别慌');
    expect(updatedSession?.outcome?.recommendedAction).toBe(
      'delegate_openclaw',
    );

    const replyEvents = outreachRepo
      .listEventsBySession(session.id, 20)
      .filter((event) => event.eventType === 'reply_received');
    expect(replyEvents).toHaveLength(1);
    expect(replyEvents[0].payload?.replyPostIds).toEqual([
      'reply-2',
      'reply-3',
      'reply-4',
    ]);
  });

  it('queues delegation when a reply only provides an external artifact without a direct answer', async () => {
    const session = outreachRepo.createSession({
      originKind: 'manual_action',
      targetType: 'private',
      targetRef: 'sophia.lin',
      renderedQuestion: 'Gary 和 video 相关的具体安排是哪几天？',
      renderedContext: '如果你只有链接，也请先发过来。',
      status: 'waiting_reply',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-artifact',
      sentPostId: 'post-seed',
      nextCheckAt: Math.floor(Date.now() / 1000) - 5,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
    });

    mockRingCentralListPosts('chat-artifact', [
      {
        id: 'reply-artifact-1',
        text: "[Gary's calendar](https://calendar.example.com/gary)",
        creator: { id: 'user-42', name: 'Sophia (Jinmei) Lin' },
        creationTime: '2026-04-01T02:42:00Z',
      },
    ]);

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const updatedSession = outreachRepo.getSessionById(session.id);
    expect(updatedSession?.status).toBe('resolved');
    expect(updatedSession?.outcome?.resolutionState).toBe('insufficient');
    expect(updatedSession?.outcome?.recommendedAction).toBe(
      'delegate_openclaw',
    );

    const followUpActions = actionRepo.list({
      sourceKind: 'outreach_session',
      sourceRefId: session.id,
      limit: 10,
    }).items;
    expect(followUpActions).toHaveLength(1);
    expect(followUpActions[0].actionType).toBe('delegate_openclaw');
  });

  it('dispatches due scheduled templates and advances next dispatch', async () => {
    outreachRepo.upsertTemplate({
      id: 'template-1',
      sourceKind: 'scheduled_message',
      sourceRefId: 'template-1',
      sheetMessageId: 'template-1',
      title: '定时外联',
      questionTemplate: '请同步当前 blocker。',
      contextTemplate: '如果 blocker 未清除，请给出预计恢复时间。',
      targetType: 'group',
      targetRef: 'chat-template',
      scheduleSpec: {
        scheduleDate: '2026-03-18',
        scheduleTime: '09:00',
        repeatEvery: 1,
        repeatUnit: 'Day',
        nextDispatchAt: Math.floor(Date.now() / 1000) - 10,
      },
      enabled: true,
      maxFollowup: 2,
      followupIntervalSeconds: 7200,
      syncState: 'synced',
    });

    mockRingCentralSend('chat-template', 'post-template');

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    await engine.runSchedulerCycle();

    const sessions = outreachRepo.listSessions({
      templateId: 'template-1',
      limit: 10,
    }).items;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].status).toBe('waiting_reply');
    expect(sessions[0].followupIntervalSeconds).toBe(7200);

    const template = outreachRepo.getTemplateById('template-1');
    expect(Number(template?.scheduleSpec.nextDispatchAt)).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it('allows editing a pending approval session and respects a future send time on approval', async () => {
    const session = outreachRepo.createSession({
      originKind: 'reflection_action',
      threadId: 'thread-edit-1',
      targetType: 'private',
      targetRef: 'old-target',
      renderedQuestion: '旧问题',
      renderedContext: '旧上下文',
      status: 'pending_approval',
      requiresApproval: true,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      nextCheckAt: null,
    });

    const futureTs = Math.floor(Date.now() / 1000) + 7200;
    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    const updated = engine.updateSessionDraft(session.id, {
      targetType: 'group',
      targetRef: 'release-team',
      targetResolutionStatus: 'resolved',
      targetResolvedType: 'chat',
      targetResolvedId: 'chat-release-team',
      targetResolvedLabel: 'Release Team',
      targetResolvedChatId: 'chat-release-team',
      targetCandidates: [
        {
          kind: 'chat',
          entityId: 'chat-release-team',
          chatId: 'chat-release-team',
          label: 'Release Team',
          score: 100,
          source: 'chat',
        },
      ],
      renderedQuestion: '请同步当前 release 版本号',
      renderedContext: '如果还没发版，请给出预计时间。',
      nextCheckAt: futureTs,
    });

    expect(updated?.targetType).toBe('group');
    expect(updated?.targetRef).toBe('release-team');
    expect(updated?.renderedQuestion).toContain('release 版本号');
    expect(updated?.nextCheckAt).toBe(futureTs);
    expect(updated?.targetResolutionStatus).toBe('resolved');

    const approved = await engine.approveSession(session.id);
    expect(approved?.status).toBe('scheduled');
    expect(approved?.nextCheckAt).toBe(futureTs);

    const refreshed = outreachRepo.getSessionById(session.id);
    expect(refreshed?.status).toBe('scheduled');
    expect(refreshed?.sentPostId).toBeUndefined();

    const editedEvent = outreachRepo
      .listEventsBySession(session.id, 20)
      .find((item) => item.eventType === 'edited');
    expect(editedEvent?.payload?.targetRef).toBe('release-team');
  });

  it('backfills missing reply sender on session detail lookup', async () => {
    const session = outreachRepo.createSession({
      originKind: 'manual_action',
      targetType: 'group',
      targetRef: 'chat-backfill',
      renderedQuestion: '当前版本号是多少？',
      status: 'resolved',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-backfill',
      sentPostId: 'post-seed',
      replyPostId: 'reply-1',
      replyRawText: '26.2.10',
      replyClassification: 'answer',
      replyConfidence: 0.7,
      waitUntil: Math.floor(Date.now() / 1000) + 3600,
      nextCheckAt: null,
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/restapi/oauth/token')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
        };
      }
      if (
        url.includes(
          '/team-messaging/v1/chats/chat-backfill/posts?recordCount=50',
        )
      ) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              records: [
                {
                  id: 'reply-1',
                  text: '26.2.10',
                  creator: {
                    id: 'user-42',
                    name: 'AI Service',
                  },
                  creationTime: '2026-03-30T08:00:00Z',
                },
              ],
            }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    const detail = await engine.getSessionDetail(session.id);

    expect(detail?.session.replySender).toBe('AI Service');

    const refreshed = outreachRepo.getSessionById(session.id);
    expect(refreshed?.replySender).toBe('AI Service');
  });

  it('returns structured outreach evidence on session detail lookup', async () => {
    const session = outreachRepo.createSession({
      originKind: 'manual_action',
      targetType: 'group',
      targetRef: 'chat-evidence',
      renderedQuestion: '当前 release 风险有没有外部证据？',
      renderedContext: '如果有链接也请带上。',
      status: 'resolved',
      requiresApproval: false,
      maxFollowup: 1,
      followupIntervalSeconds: 3600,
      sentChatId: 'chat-evidence',
      sentPostId: 'post-seed',
      replyPostId: 'reply-1',
      replySender: 'Sophia (Jinmei) Lin',
      replyRawText: '风险主要在 video 相关发布窗口。',
      replyClassification: 'answer',
      replyConfidence: 0.82,
      outcome: {
        resolutionState: 'partial',
        externalEvidence: [
          {
            kind: 'link',
            title: 'Release checklist',
            url: 'https://docs.example.com/release-checklist',
            content: 'video 发布依赖项还未全部完成',
            metadata: {
              sourceSystem: 'google_workspace',
            },
          },
        ],
        candidateArtifacts: [
          {
            kind: 'reference',
            title: 'release calendar',
            url: 'https://calendar.example.com/release',
            metadata: {
              sourceSystem: 'calendar',
            },
          },
        ],
      },
    });

    const engine = new OutreachEngine(db, userDataManager, 'test-user');
    const detail = await engine.getSessionDetail(session.id);

    expect(detail?.evidence).toHaveLength(3);
    expect(detail?.evidence[0]).toMatchObject({
      sourceKind: 'outreach_reply',
      sourceId: 'reply-1',
      title: 'Sophia (Jinmei) Lin',
      content: '风险主要在 video 相关发布窗口。',
    });
    expect(detail?.evidence[1]).toMatchObject({
      sourceKind: 'link',
      title: 'Release checklist',
    });
    expect(detail?.evidence[1]?.content).toContain(
      'https://docs.example.com/release-checklist',
    );
    expect(detail?.evidence[2]).toMatchObject({
      sourceKind: 'reference',
      title: 'release calendar',
    });
  });
});
