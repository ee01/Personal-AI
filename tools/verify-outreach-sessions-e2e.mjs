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
      await route.fulfill(jsonResponse(emptyList(100)));
      return;
    }

    if (pathname.endsWith('/outreach/sessions') && request.method() === 'GET') {
      if (failSessionList) {
        await route.fulfill(
          jsonResponse({ error: 'Outreach DB unavailable' }, 503),
        );
        return;
      }
      const originKind = new URL(url).searchParams.get('originKind');
      const items =
        originKind === 'message_reaction'
          ? [messageReactionSession]
          : [outreachSession, messageReactionSession];
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
  await page.getByText('会话列表：Outreach DB unavailable').waitFor({
    timeout: 10000,
  });
  assert.equal(await page.getByText('暂无主动询问会话。').count(), 0);

  failSessionList = false;
  await page.getByRole('button', { name: '重试加载' }).click();
  await page.getByText('Release owner 已确认了吗？').waitFor({
    timeout: 10000,
  });
  assert.equal(await page.getByRole('alert').count(), 0);

  failSessionList = true;
  await page.getByRole('button', { name: '刷新' }).click();
  await page.getByRole('alert').waitFor({ timeout: 10000 });
  await page.getByText('当前继续展示上次成功加载的数据').waitFor({
    timeout: 10000,
  });
  await page.getByText('Release owner 已确认了吗？').waitFor({
    timeout: 10000,
  });

  failSessionList = false;
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/outreach?originKind=message_reaction`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.getByText('确认最终发布日期和是否需要额外资源。').waitFor({
    timeout: 10000,
  });
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
  const originalMessageLink = page.getByRole('link', { name: '打开原消息' });
  await originalMessageLink.waitFor({ timeout: 10000 });
  assert.equal(
    await originalMessageLink.getAttribute('href'),
    messageReactionSession.outcome.messageUrl,
    'Message reaction cards should link back to the original message',
  );

  await page.getByRole('link', { name: '查看详情' }).click();
  await page.getByText('状态 等待回复').waitFor({ timeout: 10000 });
  await page.getByText('消息跟进').waitFor({ timeout: 10000 });
  await page
    .getByText('这条跟进来自原始消息。系统正在检查当前会话是否已有满足完成标准的回复')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.getByRole('link', { name: '打开原消息' }).getAttribute('href'),
    messageReactionSession.outcome.messageUrl,
    'Message reaction detail should link back to the original message',
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
