import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const require = createRequire(path.join(repoRoot, 'desktop-app/package.json'));
const { chromium } = require('playwright');

const extensionPath = path.join(repoRoot, 'dist');
const userDataDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'personal-ai-outreach-sessions-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
let failSessionList = true;
let failDetailLoad = false;
let failDirectoryStatus = false;
let retryRequestCount = 0;
let retryShouldFail = true;
let approvalShouldFail = true;
let approveRequestCount = 0;
let targetSearchCount = 0;

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList(limit = 50) {
  return { items: [], total: 0, limit, offset: 0 };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const outreachSession = {
  id: 'outreach-release-owner',
  originKind: 'manual_action',
  targetType: 'group',
  targetRef: 'release-team',
  targetResolutionStatus: 'resolved',
  targetResolvedType: 'chat',
  targetResolvedId: 'chat-release-team',
  targetResolvedLabel: 'Release Team',
  targetResolvedChatId: 'chat-release-team',
  renderedQuestion: 'Release owner 已确认了吗？',
  renderedContext: '需要确认最终 owner，避免重复打扰不相关群组。',
  status: 'waiting_reply',
  requiresApproval: false,
  followupCount: 0,
  maxFollowup: 1,
  nextCheckAt: nowSeconds + 1800,
  waitUntil: nowSeconds + 3600,
  sentChatId: 'chat-release-team',
  sentPostId: 'post-release-owner',
  createdAt: nowSeconds - 120,
  updatedAt: nowSeconds - 60,
  evidence: [],
};

const messageReactionSession = {
  id: 'outreach-message-reaction',
  originKind: 'message_reaction',
  targetType: 'group',
  targetRef: 'release-team',
  targetResolutionStatus: 'resolved',
  targetResolvedType: 'chat',
  targetResolvedId: 'chat-release-team',
  targetResolvedLabel: 'Release Team（提及 Jordan Lee）',
  targetResolvedChatId: 'chat-release-team',
  renderedQuestion: '@Jordan Lee can you confirm the release date before Friday?',
  renderedContext: '确认最终发布日期和是否需要额外资源。',
  status: 'waiting_reply',
  requiresApproval: false,
  followupCount: 0,
  maxFollowup: 1,
  nextCheckAt: nowSeconds,
  waitUntil: nowSeconds + 86400,
  sentChatId: 'chat-release-team',
  sentPostId: 'post-release-date',
  createdAt: nowSeconds - 600,
  updatedAt: nowSeconds - 120,
  outcome: {
    originKind: 'message_reaction',
    originalChatId: 'chat-release-team',
    originalPostId: 'post-release-date',
    messageUrl:
      'https://app.ringcentral.com/messages/chat-release-team/post-release-date',
    senderName: 'Esone Qiu',
  },
  events: [],
  actions: [],
  evidence: [],
};

const pendingApprovalSession = {
  id: 'outreach-approval-needed',
  originKind: 'reflection_action',
  targetType: 'group',
  targetRef: 'release-approvers',
  targetResolutionStatus: 'resolved',
  targetResolvedType: 'chat',
  targetResolvedId: 'chat-release-approvers',
  targetResolvedLabel: 'Release Approvers',
  targetResolvedChatId: 'chat-release-approvers',
  renderedQuestion: '请确认 M2 发布是否可以进入灰度？',
  renderedContext: '需要目标群确认发布门槛，避免未审批外发。',
  status: 'pending_approval',
  requiresApproval: true,
  followupCount: 0,
  maxFollowup: 2,
  nextCheckAt: nowSeconds + 1800,
  createdAt: nowSeconds - 172800,
  updatedAt: nowSeconds - 172500,
  events: [],
  actions: [],
  evidence: [
    {
      sourceKind: 'message',
      sourceId: 'msg-release-approver-answer',
      title: 'Release Approvers 最近消息',
      content: 'Release Approvers 已回复：M2 灰度可以继续，但需要先确认回滚 owner。',
      metadata: {
        answerResolutionPhase: 'before_dispatch',
        hitSource: 'target_channel_history',
      },
    },
  ],
};

const futureTemplate = {
  template: {
    id: 'template-release-check',
    sourceKind: 'scheduled_messages',
    title: 'Release owner follow-up',
    questionTemplate: '明天提醒 Release Team 确认 owner',
    contextTemplate: '确保发布前 owner 已确认，不重复打扰非相关群组。',
    targetType: 'group',
    targetRef: 'release-team',
    scheduleSpec: {
      nextDispatchAt: nowSeconds + 7200,
      scheduleDate: '2026-06-14',
      scheduleTime: '09:00',
      repeatEvery: 1,
      repeatUnit: 'Day',
    },
    enabled: true,
    approvalPolicy: 'auto_when_resolved',
    maxFollowup: 1,
    followupIntervalSeconds: 3600,
    syncState: 'synced',
    lastSessionId: 'outreach-release-owner',
    createdAt: nowSeconds - 3600,
    updatedAt: nowSeconds - 300,
  },
  latestSession: {
    ...outreachSession,
    id: 'outreach-release-owner-previous',
    status: 'resolved',
    outcome: {
      summary: '上次已确认 release owner。',
    },
  },
};

const retriableSession = {
  id: 'outreach-retry-failed',
  originKind: 'manual_action',
  targetType: 'group',
  targetRef: 'ops-team',
  targetResolutionStatus: 'resolved',
  targetResolvedType: 'chat',
  targetResolvedId: 'chat-ops-team',
  targetResolvedLabel: 'Ops Team',
  targetResolvedChatId: 'chat-ops-team',
  renderedQuestion: 'RingCentral 发送失败，需要重试',
  renderedContext: '确认外部消息恢复后重新发起主动询问。',
  status: 'failed',
  requiresApproval: false,
  followupCount: 1,
  maxFollowup: 1,
  sentChatId: 'chat-ops-team',
  sentPostId: 'post-failed-outreach',
  errorCode: 'ringcentral_send_failed',
  errorMessage: 'RingCentral 503',
  createdAt: nowSeconds - 900,
  updatedAt: nowSeconds - 300,
  evidence: [],
};

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  await context.route('http://localhost:3210/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;

    if (pathname.endsWith('/config') && request.method() === 'GET') {
      await route.fulfill(
        jsonResponse({
          outreachEnabled: true,
          ringCentralServerUrl: 'https://platform.ringcentral.example.com',
          ringCentralClientId: 'client-id',
          ringCentralClientSecretConfigured: true,
          ringCentralJwtConfigured: true,
        }),
      );
      return;
    }

    if (pathname.endsWith('/outreach/summary') && request.method() === 'GET') {
      await route.fulfill(
        jsonResponse({
          upcomingCount: 0,
          waitingReplyCount: failSessionList ? 0 : 1,
          escalatedCount: 0,
          pendingApprovalCount: 0,
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/outreach/templates/runtime-status') &&
      request.method() === 'GET'
    ) {
      await route.fulfill(
        jsonResponse({ items: [futureTemplate], total: 1, limit: 100, offset: 0 }),
      );
      return;
    }

    if (pathname.endsWith('/outreach/sessions') && request.method() === 'GET') {
      if (failSessionList) {
        await route.fulfill(
          jsonResponse({ error: 'Outreach DB unavailable' }, 503),
        );
        return;
      }
      const searchParams = new URL(url).searchParams;
      const originKind = searchParams.get('originKind');
      const status = searchParams.get('status');
      const items =
        status === 'pending_approval'
          ? [pendingApprovalSession]
          : originKind === 'message_reaction'
          ? [messageReactionSession]
          : originKind === 'reflection'
            ? []
            : [outreachSession, messageReactionSession, retriableSession];
      await route.fulfill(
        jsonResponse({
          items,
          total: items.length,
          limit: 50,
          offset: 0,
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/outreach/sessions/outreach-retry-failed/retry') &&
      request.method() === 'POST'
    ) {
      retryRequestCount += 1;
      await delay(300);
      if (retryShouldFail) {
        await route.fulfill(
          jsonResponse({ error: 'RingCentral retry gateway down' }, 503),
        );
        return;
      }
      retriableSession.status = 'scheduled';
      retriableSession.followupCount = 0;
      retriableSession.nextCheckAt = nowSeconds + 60;
      retriableSession.errorCode = undefined;
      retriableSession.errorMessage = undefined;
      retriableSession.updatedAt = nowSeconds;
      await route.fulfill(jsonResponse({ session: retriableSession }));
      return;
    }

    if (
      pathname.endsWith('/outreach/sessions/outreach-approval-needed/approve') &&
      request.method() === 'POST'
    ) {
      approveRequestCount += 1;
      await delay(300);
      if (approvalShouldFail) {
        await route.fulfill(
          jsonResponse({ error: 'RingCentral approval gateway down' }, 503),
        );
        return;
      }
      pendingApprovalSession.status = 'scheduled';
      pendingApprovalSession.requiresApproval = false;
      pendingApprovalSession.nextCheckAt = nowSeconds + 1800;
      pendingApprovalSession.updatedAt = nowSeconds;
      pendingApprovalSession.events = [
        {
          id: 'event-approved',
          sessionId: pendingApprovalSession.id,
          eventType: 'approved',
          payload: {},
          createdAt: nowSeconds,
        },
      ];
      await route.fulfill(jsonResponse({ session: pendingApprovalSession }));
      return;
    }

    if (
      pathname.endsWith('/outreach/sessions/outreach-approval-needed') &&
      request.method() === 'GET'
    ) {
      if (failDetailLoad) {
        await route.fulfill(
          jsonResponse({ error: 'Outreach detail store unavailable' }, 503),
        );
        return;
      }
      await route.fulfill(jsonResponse(pendingApprovalSession));
      return;
    }

    if (
      pathname.endsWith('/outreach/directory/status') &&
      request.method() === 'GET'
    ) {
      if (failDirectoryStatus) {
        await route.fulfill(
          jsonResponse({ error: 'Outreach directory cache unavailable' }, 503),
        );
        return;
      }
      await route.fulfill(
        jsonResponse({
          items: [
            {
              scope: 'teams',
              status: 'ready',
              recordCount: 12,
              stale: false,
            },
            {
              scope: 'users',
              status: 'ready',
              recordCount: 24,
              stale: false,
            },
          ],
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/outreach/targets/search') &&
      request.method() === 'GET'
    ) {
      targetSearchCount += 1;
      await route.fulfill(
        jsonResponse({
          items: [
            {
              kind: 'chat',
              entityId: 'chat-release-approvers',
              label: 'Release Approvers',
              subtitle: 'team chat',
              chatId: 'chat-release-approvers',
              score: 96,
            },
          ],
          total: 1,
          directoryStatus: [
            {
              scope: 'teams',
              status: 'ready',
              recordCount: 12,
              stale: false,
            },
          ],
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/outreach/sessions/outreach-message-reaction') &&
      request.method() === 'GET'
    ) {
      await route.fulfill(jsonResponse(messageReactionSession));
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(url)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach`,
    { waitUntil: 'domcontentloaded' },
  );

  const alert = page.getByRole('alert');
  await alert.waitFor({ timeout: 10000 });
  await alert
    .getByText('会话列表：Outreach DB unavailable', { exact: true })
    .waitFor({
      timeout: 10000,
    });
  assert.equal(await page.getByText('暂无主动询问会话。').count(), 0);

  failSessionList = false;
  await page.getByRole('button', { name: '重试加载' }).click();
  await page
    .locator('.session-card', { hasText: outreachSession.renderedQuestion })
    .waitFor({ timeout: 10000 });
  await page.getByText('本页优先级').waitFor({ timeout: 10000 });
  const filterScopeReceipt = page.getByLabel('主动询问筛选范围回执');
  await filterScopeReceipt
    .getByText('筛选范围回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('当前筛选：全部状态 / 全部来源。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('本次可见 3 条会话、1 个待触发计划。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('当前是全部状态与全部来源视图；计划 ID 和 threadId 未限制列表范围。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('筛选、清除筛选或刷新只同步 URL 并读取状态')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('先处理 1 个失败、无回复或已升级终态')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      '刷新和筛选只读取 Memory Service 状态，不会批准、发送、追问、重试或写回 RingCentral',
    )
    .waitFor({ timeout: 10000 });
  const focusLane = page.getByLabel('主动询问本轮处理对象');
  await focusLane.getByText('本轮处理对象 · 终态恢复').waitFor({
    timeout: 10000,
  });
  await focusLane.getByText(retriableSession.renderedQuestion).waitFor({
    timeout: 10000,
  });
  await focusLane
    .getByText('本卡只定位会话；不会调用重试、重新发送、写入 RingCentral 或修改 Memory Service')
    .waitFor({ timeout: 10000 });
  const focusActionLink = focusLane.getByRole('link', {
    name: /^打开重试详情：/,
  });
  await focusActionLink.waitFor({ timeout: 10000 });
  assert.match(
    (await focusActionLink.getAttribute('title')) || '',
    /不会执行卡片建议、批准、取消、发送、追问、重试/,
    'Focus action link should expose its navigation-only boundary before click',
  );
  const templateCard = page.locator('.template-card', {
    hasText: futureTemplate.template.questionTemplate,
  });
  await templateCard.getByText('计划推进回执').waitFor({ timeout: 10000 });
  await templateCard
    .getByText('这只是待触发计划，还不是已经发出的消息')
    .waitFor({ timeout: 10000 });
  await templateCard
    .getByText('可查看上次执行（已拿到结果）或回到定时消息计划调整目标、问题和时间')
    .waitFor({ timeout: 10000 });
  const templateTitleLink = templateCard.getByRole('link', {
    name: /^查看计划会话：/,
  });
  await templateTitleLink.waitFor({ timeout: 10000 });
  assert.match(
    (await templateTitleLink.getAttribute('title')) || '',
    /只更新 URL 和读取状态，不会立即生成会话、审批、发送、追问/,
    'Template title link should explain that it only filters the list',
  );
  const latestSessionLink = templateCard.getByRole('link', {
    name: /^查看上次执行：/,
  });
  await latestSessionLink.waitFor({ timeout: 10000 });
  assert.match(
    (await latestSessionLink.getAttribute('title')) || '',
    /只读取时间线和证据，不会重试、重新发送、取消/,
    'Latest-session link should expose its read-only session boundary',
  );
  const waitingCard = page.locator('.session-card', {
    hasText: outreachSession.renderedQuestion,
  });
  await waitingCard.getByText('会话推进回执').waitFor({ timeout: 10000 });
  await waitingCard
    .getByText('不会在等待窗口内重复打扰同一目标')
    .waitFor({ timeout: 10000 });
  const retryCard = page.locator('.session-card', {
    hasText: retriableSession.renderedQuestion,
  });
  await retryCard.getByText('旧失败原因：RingCentral 503').waitFor({
    timeout: 10000,
  });
  const retryButton = retryCard.getByRole('button', { name: /重试/ });
  await retryButton.waitFor({ timeout: 10000 });
  assert.match(
    (await retryButton.getAttribute('title')) || '',
    /重置为「已排程」/,
    'Terminal retry button should explain the reset boundary before click',
  );
  assert.match(
    (await retryButton.getAttribute('aria-label')) || '',
    /^重试：/,
    'Terminal retry button should expose an accessible action boundary',
  );
  await retryButton.click();
  const retryOperationReceipt = retryCard.getByLabel('主动询问列表操作回执');
  await retryOperationReceipt
    .getByText('列表操作提交中：重试主动询问请求已提交', { exact: true })
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('当前卡片仍是上次成功读取的状态：失败；目标：ops-team。')
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('重置后的状态、retried 审计事件和下一轮排程要等 Memory Service 返回并刷新列表后才能确认')
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('这条提交中回执不代表 RingCentral 已发送、对方已回复、会话已取消、会话已重试')
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('列表操作失败：重试主动询问未确认', { exact: true })
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('失败原因：RingCentral retry gateway down')
    .waitFor({ timeout: 10000 });
  await retryOperationReceipt
    .getByText('这次失败不会被当成已批准、已发送、已取消、已重试、已拿到回复或已写回 RingCentral。')
    .waitFor({ timeout: 10000 });
  retryShouldFail = false;
  await retryButton.click();
  await retryOperationReceipt
    .getByText('列表操作提交中：重试主动询问请求已提交', { exact: true })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.session-card', { hasText: retriableSession.renderedQuestion })
    .locator('.badge', { hasText: '已排程' })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.session-card', { hasText: retriableSession.renderedQuestion })
    .getByText('列表操作回执：重试主动询问已处理', { exact: true })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.session-card', { hasText: retriableSession.renderedQuestion })
    .getByText('刷新后状态：已排程；目标：ops-team。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.session-card', { hasText: retriableSession.renderedQuestion })
    .getByText('这只确认重试请求已被 Memory Service 处理；新的外发、等待回复或失败状态仍以刷新后的会话事件为准。')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.session-card', { hasText: retriableSession.renderedQuestion })
    .getByText('刷新列表不会立即发送')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前重点是等待 2 个已发出会话的回复')
    .waitFor({ timeout: 10000 });
  await focusLane.getByText('本轮处理对象 · 等待回复').waitFor({
    timeout: 10000,
  });
  await focusLane.getByText(outreachSession.renderedQuestion).waitFor({
    timeout: 10000,
  });
  await focusLane
    .getByText('查看不会追问、结束会话或发送新消息；引擎只按等待窗口继续检查')
    .waitFor({ timeout: 10000 });
  assert.equal(
    retryRequestCount,
    2,
    'Terminal outreach cards should call the retry endpoint from the list page',
  );
  assert.equal(await page.getByRole('alert').count(), 0);

  const refreshButton = page.getByRole('button', { name: /^刷新：/ });
  assert.match(
    (await refreshButton.getAttribute('title')) || '',
    /重新读取主动询问运行配置、统计摘要、待触发计划和当前筛选会话/,
    'Outreach refresh button should describe its read-only refresh scope',
  );
  assert.match(
    (await refreshButton.getAttribute('aria-label')) || '',
    /不会批准、取消、发送、追问、重试/,
    'Outreach refresh button should expose that it does not mutate sessions',
  );
  failSessionList = true;
  await refreshButton.click();
  await page.getByRole('alert').waitFor({ timeout: 10000 });
  await page.getByText('当前继续展示上次成功加载的数据').waitFor({
    timeout: 10000,
  });
  await page.getByText('先重试加载：当前继续展示上次成功数据').waitFor({
    timeout: 10000,
  });
  await waitingCard.getByText(outreachSession.renderedQuestion).waitFor({
    timeout: 10000,
  });

  failSessionList = false;
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach?originKind=message_reaction`,
    { waitUntil: 'domcontentloaded' },
  );
  const messageReactionCard = page.locator('.session-card', {
    hasText: messageReactionSession.renderedQuestion,
  });
  await messageReactionCard
    .getByText('确认最终发布日期和是否需要额外资源。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前重点是等待 1 个已发出会话的回复')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('当前筛选：全部状态 / 来源 消息跟进。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('本次可见 1 条会话、0 个待触发计划。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('隐藏依据：未筛选快照里有 2 条会话和 1 个待触发计划被当前筛选隐藏。')
    .waitFor({ timeout: 10000 });
  await focusLane.getByText('先核对原消息线程').waitFor({
    timeout: 10000,
  });
  await focusLane
    .getByText(messageReactionSession.renderedQuestion)
    .waitFor({ timeout: 10000 });
  await focusLane
    .getByText('必要时从详情或原消息链接核对上下文，避免重复追问已经答过的问题')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.filter-select').nth(1).inputValue(),
    'message_reaction',
    'Message reaction source filter should be selectable',
  );
  await page
    .locator('.session-card .badge.muted', { hasText: '消息跟进' })
    .first()
    .waitFor({ timeout: 10000 });
  await page
    .getByText('这条跟进来自原始消息；系统会先检查当前会话是否已有满足目标的回复')
    .waitFor({ timeout: 10000 });
  await messageReactionCard
    .getByText('先检查原消息线程是否已有满足目标的回复')
    .waitFor({ timeout: 10000 });
  const originalMessageLink = page.getByRole('link', {
    name: /^打开原消息：/,
  });
  await originalMessageLink.waitFor({ timeout: 10000 });
  assert.equal(
    await originalMessageLink.getAttribute('href'),
    messageReactionSession.outcome.messageUrl,
    'Message reaction cards should link back to the original message',
  );
  assert.match(
    (await originalMessageLink.getAttribute('title')) || '',
    /不会发送新追问、标记已回复、更新 Outreach 状态/,
    'Original-message link should explain that it only opens context',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach?originKind=reflection`,
    { waitUntil: 'domcontentloaded' },
  );
  const filteredEmptyReceipt = page.getByLabel('主动询问筛选空结果回执');
  await filteredEmptyReceipt
    .getByText('筛选空结果回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('当前筛选：全部状态 / 来源 自我反思。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('本次可见 0 条会话、0 个待触发计划。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('隐藏依据：未筛选快照里有 3 条会话和 1 个待触发计划被当前筛选隐藏。')
    .waitFor({ timeout: 10000 });
  await filteredEmptyReceipt
    .getByText('当前筛选没有匹配的主动询问会话或待触发计划。')
    .waitFor({ timeout: 10000 });
  await filteredEmptyReceipt
    .getByText('当前筛选：全部状态 / 来源 自我反思。')
    .waitFor({ timeout: 10000 });
  await filteredEmptyReceipt
    .getByText('未筛选快照里还有 3 条会话和 1 个待触发计划被当前筛选隐藏。')
    .waitFor({ timeout: 10000 });
  await filteredEmptyReceipt
    .getByText('清除筛选或刷新只会重新读取 Memory Service')
    .waitFor({ timeout: 10000 });
  assert.equal(await page.getByText('暂无主动询问会话。').count(), 0);
  const clearFilterButton = filteredEmptyReceipt.getByRole('button', {
    name: /^清除筛选：/,
  });
  assert.match(
    (await clearFilterButton.getAttribute('title')) || '',
    /只更新本页 URL 和重新读取列表/,
    'Clear-filter button should explain that it only resets the list scope',
  );
  await clearFilterButton.click();
  await page
    .locator('.session-card', { hasText: outreachSession.renderedQuestion })
    .waitFor({ timeout: 10000 });
  assert.equal(
    new URL(page.url()).hash,
    '#/outreach',
    'Clearing filters should return to the unfiltered outreach list',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach?status=pending_approval`,
    { waitUntil: 'domcontentloaded' },
  );
  const approvalListCard = page.locator('.session-card', {
    hasText: pendingApprovalSession.renderedQuestion,
  });
  await approvalListCard.waitFor({ timeout: 10000 });
  const approvalListReview = approvalListCard.getByLabel(
    '主动询问列表发送前复核',
  );
  await approvalListReview
    .getByText('列表发送前复核', { exact: true })
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('当前筛选：状态 待审批 / 全部来源。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('本次可见 1 条会话、0 个待触发计划。')
    .waitFor({ timeout: 10000 });
  await filterScopeReceipt
    .getByText('隐藏依据：未筛选快照里有 2 条会话和 1 个待触发计划被当前筛选隐藏。')
    .waitFor({ timeout: 10000 });
  await approvalListReview
    .getByText(/已有证据\/回复线索：Release Approvers 已回复：M2 灰度可以继续，但需要先确认回滚 owner。/)
    .waitFor({ timeout: 10000 });
  await approvalListReview
    .getByText('先进详情页核对发送前复核')
    .waitFor({ timeout: 10000 });
  await approvalListReview
    .getByText('列表不会在已有线索时直接批准发送')
    .waitFor({ timeout: 10000 });
  const guardedApproveButton = approvalListCard.getByRole('button', {
    name: '先到详情复核',
  });
  await guardedApproveButton.waitFor({ timeout: 10000 });
  assert.match(
    (await guardedApproveButton.getAttribute('title')) || '',
    /已有证据或回复线索/,
    'Guarded approve button should explain why detail review is required',
  );
  assert.match(
    (await guardedApproveButton.getAttribute('aria-label')) || '',
    /^先到详情复核：/,
    'Guarded approve button should expose an accessible review boundary',
  );
  assert.equal(
    await guardedApproveButton.isDisabled(),
    true,
    'Pending approval rows with pre-dispatch evidence should require detail review before approving',
  );
  const approvalListCancelButton = approvalListCard.getByRole('button', {
    name: /取消/,
  });
  assert.match(
    (await approvalListCancelButton.getAttribute('title')) || '',
    /停止这条主动询问后续发送、检查和追问/,
    'List cancel button should explain that it stops follow-up without revoking sent messages',
  );
  const approvalReviewLink = approvalListCard.getByRole('link', {
    name: /^进入详情复核：/,
  });
  await approvalReviewLink.waitFor({ timeout: 10000 });
  assert.match(
    (await approvalReviewLink.getAttribute('title')) || '',
    /只打开 Outreach 会话详情.*不会批准、取消、发送、追问、重试/,
    'Approval review link should explain that it only opens the detail page',
  );

  failDetailLoad = true;
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach/${pendingApprovalSession.id}`,
    { waitUntil: 'domcontentloaded' },
  );
  const detailLoadError = page.getByLabel('主动询问详情加载失败回执');
  await detailLoadError
    .getByText('主动询问详情加载失败', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailLoadError
    .getByText('会话详情：Outreach detail store unavailable')
    .waitFor({ timeout: 10000 });
  await detailLoadError
    .getByText('页面没有把这次读取失败当成会话不存在')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.getByText('未找到该会话。').count(),
    0,
    'Detail load failures should not be presented as a missing session',
  );
  const retryDetailButton = detailLoadError.getByRole('button', {
    name: /^重试详情：/,
  });
  assert.match(
    (await retryDetailButton.getAttribute('title')) || '',
    /重新读取当前 Outreach 会话详情和目标目录状态/,
    'Detail retry button should explain the reload scope',
  );
  assert.match(
    (await retryDetailButton.getAttribute('aria-label')) || '',
    /不会批准、发送、追问、重试、取消、保存草稿或写回 RingCentral/,
    'Detail retry button should expose its no-mutation boundary',
  );
  failDetailLoad = false;
  failDirectoryStatus = true;
  await retryDetailButton.click();
  await page
    .getByText(pendingApprovalSession.renderedQuestion)
    .waitFor({ timeout: 10000 });
  const detailLoadWarning = page.getByLabel('主动询问详情降级回执');
  await detailLoadWarning
    .getByText('详情已加载，辅助状态读取失败', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailLoadWarning
    .getByText('目标目录状态：Outreach directory cache unavailable')
    .waitFor({ timeout: 10000 });
  await detailLoadWarning
    .getByText('主会话详情仍按当前快照展示')
    .waitFor({ timeout: 10000 });
  failDirectoryStatus = false;

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach?originKind=message_reaction`,
    { waitUntil: 'domcontentloaded' },
  );
  await messageReactionCard.waitFor({ timeout: 10000 });
  const listDetailLink = messageReactionCard.getByRole('link', {
    name: /^查看详情：/,
  });
  assert.match(
    (await listDetailLink.getAttribute('title')) || '',
    /只打开 Outreach 会话详情.*不会批准、取消、发送、追问/,
    'List detail link should expose its navigation-only boundary',
  );
  await listDetailLink.click();
  await page.locator('.outreach-detail-page').waitFor({ timeout: 10000 });
  await page.getByText('状态 等待回复').waitFor({ timeout: 10000 });
  await page
    .locator('.hero-metrics')
    .getByText('消息跟进')
    .waitFor({ timeout: 10000 });
  const detailOperationReceipt = page.getByLabel('主动询问本次操作范围');
  await detailOperationReceipt
    .getByText('本次操作范围', { exact: true })
    .waitFor({ timeout: 10000 });
  await detailOperationReceipt
    .getByText('这条跟进先检查原消息线程和目标会话回复；刷新详情不会发送新追问。')
    .waitFor({ timeout: 10000 });
  await detailOperationReceipt
    .getByText(/引擎才会判断是否追问、延期或结束；追问上限仍是 0\/1。/)
    .waitFor({ timeout: 10000 });
  await detailOperationReceipt
    .getByText('取消只停止后续检查和追问，不删除已发 RingCentral 消息、来源证据或已记录事件。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('这条跟进来自原始消息。系统正在检查当前会话是否已有满足完成标准的回复')
    .waitFor({ timeout: 10000 });
  const detailOriginalMessageLink = page.getByRole('link', {
    name: /^打开原消息：/,
  });
  assert.equal(
    await detailOriginalMessageLink.getAttribute('href'),
    messageReactionSession.outcome.messageUrl,
    'Message reaction detail should link back to the original message',
  );
  assert.match(
    (await detailOriginalMessageLink.getAttribute('title')) || '',
    /不会发送新追问、标记已回复、更新 Outreach 状态、保存草稿/,
    'Detail source-message link should expose its no-write boundary',
  );

  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach/${pendingApprovalSession.id}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByText(pendingApprovalSession.renderedQuestion)
    .waitFor({ timeout: 10000 });
  const preDispatchReview = page.getByLabel('主动询问发送前复核');
  await preDispatchReview
    .getByText('发送前复核', { exact: true })
    .waitFor({ timeout: 10000 });
  await preDispatchReview
    .getByText('目标已确认：群组「Release Approvers」。')
    .waitFor({ timeout: 10000 });
  await preDispatchReview
    .getByText(/批准后计划在 .* 发送。/)
    .waitFor({ timeout: 10000 });
  await preDispatchReview
    .getByText(/这条会话最后更新于 .*前；批准前建议核对问题是否仍然需要外发。/)
    .waitFor({ timeout: 10000 });
  await preDispatchReview
    .getByText(/本页已有证据线索：Release Approvers 已回复：M2 灰度可以继续，但需要先确认回滚 owner。/)
    .waitFor({ timeout: 10000 });
  await preDispatchReview
    .getByText('复核回执只读取当前详情页快照，不会自动刷新 RingCentral、发送消息、确认答案或写用户画像。')
    .waitFor({ timeout: 10000 });
  const editButton = page.getByRole('button', { name: /编辑目标与时间/ });
  assert.match(
    (await editButton.getAttribute('title')) || '',
    /只打开本页发送前草稿/,
    'Detail edit button should explain that opening edit mode is local draft-only',
  );
  await editButton.click();
  const directoryRefreshButton = page.getByRole('button', {
    name: /^刷新目录：/,
  });
  assert.match(
    (await directoryRefreshButton.getAttribute('title')) || '',
    /刷新 RingCentral 目标目录缓存.*不会保存本页草稿、批准、发送/,
    'Directory refresh button should distinguish cache refresh from session writes',
  );
  const targetSearchButton = page.getByRole('button', {
    name: /^重新检索：/,
  });
  assert.match(
    (await targetSearchButton.getAttribute('aria-label')) || '',
    /只更新本页候选列表，不会保存草稿、批准、发送/,
    'Target search button should expose that search is draft-local',
  );
  const draftReceipt = page.getByLabel('主动询问未保存草稿回执');
  await draftReceipt
    .getByText('未保存草稿回执', { exact: true })
    .waitFor({ timeout: 10000 });
  await draftReceipt
    .getByText('暂无未保存字段；你可以继续修改、保存调整或取消编辑。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    targetSearchCount,
    0,
    'Entering edit mode for an already-resolved target should not re-search and dirty the draft',
  );
  await page.locator('textarea').first().fill('请确认 M2 发布能否今天进入灰度？');
  await draftReceipt.getByText('未保存字段：问题。').waitFor({
    timeout: 10000,
  });
  await draftReceipt
    .getByText('保存调整后才会更新 Memory Service 会话草稿；批准、发送和追问仍按当前状态另行推进。')
    .waitFor({ timeout: 10000 });
  await draftReceipt
    .getByText('取消编辑、返回列表或离开页面会丢弃这些本页草稿，不会把草稿写入队列。')
    .waitFor({ timeout: 10000 });
  let backDialogMessage = '';
  page.once('dialog', async (dialog) => {
    backDialogMessage = dialog.message();
    await dialog.dismiss();
  });
  const backToListButton = page.getByRole('button', {
    name: /返回主动询问列表/,
  });
  assert.match(
    (await backToListButton.getAttribute('title')) || '',
    /有未保存编辑草稿，会先询问是否丢弃/,
    'Back button should explain the unsaved-draft boundary before navigation',
  );
  await backToListButton.click();
  assert.match(backDialogMessage, /编辑草稿尚未保存/);
  await page.locator('.outreach-detail-page').waitFor({ timeout: 10000 });
  await draftReceipt.getByText('未保存字段：问题。').waitFor({
    timeout: 10000,
  });
  const cancelEditButton = page.getByRole('button', { name: /取消编辑/ });
  assert.match(
    (await cancelEditButton.getAttribute('aria-label')) || '',
    /^取消编辑：/,
    'Cancel edit button should expose that it discards only local draft state',
  );
  await cancelEditButton.click();
  const discardReceipt = page.getByLabel('主动询问操作回执');
  await discardReceipt
    .getByText('操作回执：未保存草稿已丢弃')
    .waitFor({ timeout: 10000 });
  await discardReceipt
    .getByText('已恢复为 Memory Service 上次确认的会话内容。')
    .waitFor({ timeout: 10000 });
  await discardReceipt
    .getByText('没有保存目标、问题、完成标准或计划时间，也没有批准、发送、追问或写回 RingCentral。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(pendingApprovalSession.renderedQuestion)
    .waitFor({ timeout: 10000 });
  assert.equal(
    await draftReceipt.count(),
    0,
    'Draft receipt should disappear after cancelling edit mode',
  );
  const detailApproveButton = page.getByRole('button', { name: /批准发送/ });
  assert.match(
    (await detailApproveButton.getAttribute('title')) || '',
    /交给 Outreach 引擎处理/,
    'Detail approve button should explain the external-dispatch boundary before click',
  );
  await detailApproveButton.click();
  const operationReceipt = page.getByLabel('主动询问操作回执');
  await operationReceipt
    .getByText('操作提交中回执：批准发送请求已提交')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText(/当前仍显示上次成功读取的状态 待审批，目标：群组「Release Approvers」。/)
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('按钮已临时锁定，避免重复提交；审批、排程、dispatched 事件、sentPostId 和等待回复状态要等 Memory Service 返回后才能确认。')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('提交中回执不代表 RingCentral 已发送、对方已回复、用户画像已写入、外部平台已同步或来源证据已删除。')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('操作失败回执：批准发送未确认')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('RingCentral approval gateway down')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('页面不会把这次点击当成已批准、已发送、已重试、已取消或已保存。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    approveRequestCount,
    1,
    'First pending approval detail attempt should call approve endpoint once',
  );

  approvalShouldFail = false;
  await detailApproveButton.click();
  await operationReceipt
    .getByText('操作提交中回执：批准发送请求已提交')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('操作回执：批准请求已由 Memory Service 处理')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('当前会话状态：已排程；目标：群组「Release Approvers」。')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('这表示审批状态已刷新；是否已经发出仍以 dispatched 事件、sentPostId 和等待回复状态为准。')
    .waitFor({ timeout: 10000 });
  await operationReceipt
    .getByText('这次回执不代表对方已回复、不写用户画像、不确认决策，也不向其它外部系统同步。')
    .waitFor({ timeout: 10000 });
  await page.getByText('状态 已排程').waitFor({ timeout: 10000 });
  assert.equal(
    approveRequestCount,
    2,
    'Successful pending approval detail attempt should call approve endpoint again',
  );

  assert.deepEqual(
    pageErrors,
    [],
    `Outreach page errors: ${pageErrors.join('; ')}`,
  );
  console.log(
    'verify-outreach-sessions-e2e: failure recovery and message-reaction source UX passed',
  );
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
