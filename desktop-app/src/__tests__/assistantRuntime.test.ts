import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAskContextFromTurns,
  buildAssistantRuntimeSummary,
  classifyRememberText,
  hasExplicitRememberIntent,
  isStandaloneRememberRequest,
} from '../assistantRuntime.js';
import type { BridgeStatus } from '../types.js';

function createStatus(overrides: Partial<BridgeStatus> = {}): BridgeStatus {
  return {
    paired: true,
    authStatus: 'connected',
    browserRunning: true,
    bindings: {},
    threads: [],
    appVersion: '2.0.2',
    memoryServiceConfigured: true,
    autoSyncEnabled: true,
    blockingReasons: [],
    syncReadiness: {
      stableMemory: { ready: true, reasons: [], intervalMs: 1 },
      mobileBriefing: { ready: true, reasons: [], intervalMs: 1 },
      reminderSync: { ready: true, reasons: [], intervalMs: 1 },
    },
    memoryGrowth: {
      windowDays: 90,
      recentMessageCount: 24,
      lowMessageThreshold: 50,
      belowThreshold: true,
    },
    syncState: {
      timerActive: true,
      running: false,
      autoSyncEnabled: true,
      memoryServiceConfigured: true,
      pollIntervalMs: 300000,
      recentAttempts: [],
      tasks: {
        stableMemory: { intervalMs: 1, due: false },
        mobileBriefing: { intervalMs: 1, due: false },
        reminderSync: { intervalMs: 1, due: false },
      },
    },
    ...overrides,
  };
}

test('buildAskContextFromTurns keeps last 4 turns and truncates oldest context', () => {
  const context = buildAskContextFromTurns([
    { userText: 'u1', assistantText: 'a1' },
    { userText: 'u2', assistantText: 'a2' },
    { userText: 'u3', assistantText: 'a3' },
    { userText: 'u4', assistantText: 'a4' },
    { userText: 'u5', assistantText: 'a5' },
  ]);

  assert.equal(context.includes('u1'), false);
  assert.equal(context.includes('u2'), true);
  assert.equal(context.includes('a5'), true);
});

test('classifyRememberText maps response preferences to preference items', () => {
  const result = classifyRememberText(
    '请帮我记住：以后优先用中文、简洁一点回答',
  );
  assert.equal(result.itemType, 'preference');
  assert.equal(result.itemKey, 'language_preference');
});

test('classifyRememberText maps timezone and role to fact items', () => {
  const timezone = classifyRememberText('请帮我记住我的时区是 Asia/Shanghai');
  assert.equal(timezone.itemType, 'fact');
  assert.equal(timezone.itemKey, 'timezone');

  const role = classifyRememberText('记住我的角色是产品负责人');
  assert.equal(role.itemType, 'fact');
  assert.equal(role.itemKey, 'role');
});

test('isStandaloneRememberRequest distinguishes remember-only from mixed question', () => {
  assert.equal(isStandaloneRememberRequest('请帮我记住我偏好中文回复'), true);
  assert.equal(
    isStandaloneRememberRequest(
      '请帮我记住我偏好中文回复，然后总结今天发生了什么？',
    ),
    false,
  );
});

test('hasExplicitRememberIntent avoids recall questions and accepts command forms', () => {
  assert.equal(hasExplicitRememberIntent('你还记住我的回复偏好吗？'), false);
  assert.equal(
    hasExplicitRememberIntent('Do you remember my timezone?'),
    false,
  );
  assert.equal(hasExplicitRememberIntent('请记下：我偏好中文回复'), true);
  assert.equal(
    hasExplicitRememberIntent('Remember that my timezone is Asia/Shanghai'),
    true,
  );
});

test('buildAssistantRuntimeSummary picks top status by defined priority', () => {
  const summary = buildAssistantRuntimeSummary({
    status: createStatus({
      blockingReasons: [
        {
          code: 'memory_service_not_configured',
          message: '还没有连接 Memory Service',
          syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
        },
      ],
    }),
    confirmRequests: {
      items: [{ id: 'cr-1', question: '是否确认这条偏好？' }],
    },
    runningActions: {
      items: [
        { id: 'act-1', title: 'OpenClaw 正在打开页面', queueStatus: 'running' },
      ],
    },
    outreachSummary: {
      waitingReplyCount: 1,
      pendingApprovalCount: 0,
      escalatedCount: 0,
    },
    waitingReplySessions: {
      items: [
        {
          id: 'os-1',
          status: 'waiting_reply',
          renderedQuestion: '等王峰回复部署窗口时间',
        },
      ],
    },
  });

  assert.equal(summary.topStatus?.kind, 'setup_blocker');
  assert.equal(summary.items[0]?.kind, 'setup_blocker');
  assert.equal(summary.items.length >= 3, true);
  assert.equal(summary.memoryGrowth?.belowThreshold, true);
});

test('buildAssistantRuntimeSummary surfaces Doubao sync issues before confirmations', () => {
  const summary = buildAssistantRuntimeSummary({
    status: createStatus({
      syncState: {
        timerActive: true,
        running: false,
        autoSyncEnabled: true,
        memoryServiceConfigured: true,
        pollIntervalMs: 300000,
        lastErrorAt: '2026-05-08T01:19:27.852Z',
        lastErrorMessage: 'fetch failed',
        recentAttempts: [],
        tasks: {
          stableMemory: { intervalMs: 1, due: true },
          mobileBriefing: { intervalMs: 1, due: false },
          reminderSync: { intervalMs: 1, due: false },
        },
      },
    }),
    confirmRequests: {
      items: [{ id: 'cr-1', question: '是否确认这条偏好？' }],
    },
  });

  assert.equal(summary.topStatus?.kind, 'sync_issue');
  assert.equal(summary.items[0]?.title, '豆包同步异常');
  assert.match(summary.items[0]?.summary || '', /fetch failed/);
});

test('buildAssistantRuntimeSummary explains failed Doubao sync lane in status card details', () => {
  const summary = buildAssistantRuntimeSummary({
    status: createStatus({
      syncState: {
        timerActive: true,
        running: false,
        autoSyncEnabled: true,
        memoryServiceConfigured: true,
        pollIntervalMs: 300000,
        lastErrorAt: '2026-05-08T01:19:27.852Z',
        lastErrorMessage:
          'Doubao challenge detected before send (verify you are human)',
        recentAttempts: [
          {
            id: 'attempt-1',
            kind: 'reminder_sync',
            trigger: 'manual',
            status: 'failed',
            startedAt: '2026-05-08T01:19:20.000Z',
            completedAt: '2026-05-08T01:19:27.852Z',
            durationMs: 7852,
            errorMessage:
              'Doubao challenge detected before send (verify you are human)',
          },
        ],
        tasks: {
          stableMemory: { intervalMs: 1, due: false },
          mobileBriefing: { intervalMs: 1, due: false },
          reminderSync: { intervalMs: 1, due: true },
        },
      },
    }),
  });

  const issue = summary.items[0];
  assert.equal(issue?.kind, 'sync_issue');
  assert.match(issue?.summary || '', /待办 \/ 通知手动失败/);
  assert.deepEqual(issue?.detailLines?.slice(0, 2), [
    '链路：待办 / 通知 · 手动',
    '失败时间：2026-05-08T01:19:27.852Z',
  ]);
  assert.equal(issue?.actionHint, '完成验证后重试');
});
