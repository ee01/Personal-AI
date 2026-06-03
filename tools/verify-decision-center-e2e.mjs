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
  path.join(os.tmpdir(), 'personal-ai-decision-center-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);
const answerRequests = [];
const stateRequests = [];
let failConfirmRequests = false;
let failWatchRequests = false;
let includeDeepLinkPeer = false;
let decisionState = 'pending';

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50 };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) {
    return {
      entities: { total: 0, byType: {} },
      relationships: { total: 0 },
      messages: { today: 0, thisWeek: 0 },
    };
  }
  if (pathname.endsWith('/meetings')) return { items: [], total: 0 };
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) {
    return emptyList();
  }
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  return {};
}

const decisionItem = {
  id: 'cr-risky-deploy',
  question: '是否允许 OpenClaw 继续查询生产部署状态？',
  context: 'OpenClaw 读取 Jira/部署系统时返回鉴权缺口，需要你判断是否重试。',
  options: [
    { label: '批准执行', value: 'approve' },
    { label: '拒绝执行', value: 'reject' },
    { label: '需要更多上下文', value: 'need_context' },
  ],
  evidenceRefs: [
    'action:action-risky-deploy-approval-1',
    'thread:reflection-prod-rollout',
    'message:glip-approval-context',
    'memory:deployment-risk-memory',
    'meeting:ops-review-followup',
  ],
  category: 'openclaw_delegation',
  priority: 'high',
  state: 'pending',
  routing: 'decision',
  reasonCode: 'approval_required',
  sourceAnchor: 'prod-rollout',
  snoozeCount: 0,
  createdAt: nowSeconds - 180,
  updatedAt: nowSeconds - 60,
};

const unrelatedDecisionItem = {
  ...decisionItem,
  id: 'cr-general-review',
  question: '是否继续保留旧的部署检查提醒？',
  context: '这条确认项用于证明通知深链会把目标卡片置顶，而不是只停在列表顶部。',
  evidenceRefs: ['notification:notif-general-review'],
  category: 'notification_center',
  reasonCode: 'authority_required',
  sourceAnchor: 'notification-center',
  createdAt: nowSeconds - 30,
  updatedAt: nowSeconds - 20,
};

function currentDecisionItem() {
  return {
    ...decisionItem,
    state: decisionState,
    snoozeUntil: decisionState === 'snoozed' ? nowSeconds + 24 * 3600 : null,
    snoozeCount: decisionState === 'snoozed' ? 1 : 0,
  };
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
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    if (pathname.endsWith('/confirm-requests') && request.method() === 'GET') {
      if (failConfirmRequests) {
        await route.fulfill(
          jsonResponse({ error: 'memory service unavailable' }, 503),
        );
        return;
      }
      const queue = parsed.searchParams.get('queue');
      const state = parsed.searchParams.get('state');
      if (failWatchRequests && queue === 'watch') {
        await route.fulfill(
          jsonResponse({ error: 'watch queue temporarily unavailable' }, 503),
        );
        return;
      }
      if (queue === 'decision' && state === 'pending') {
        const items =
          decisionState === 'pending'
            ? includeDeepLinkPeer
              ? [unrelatedDecisionItem, currentDecisionItem()]
              : [currentDecisionItem()]
            : [];
        await route.fulfill(
          jsonResponse({ items, total: items.length, limit: 50, state, queue }),
        );
        return;
      }
      if (queue === 'decision' && state === 'snoozed') {
        const items =
          decisionState === 'snoozed' ? [currentDecisionItem()] : [];
        await route.fulfill(
          jsonResponse({ items, total: items.length, limit: 50, state, queue }),
        );
        return;
      }
      await route.fulfill(jsonResponse({ ...emptyList(), state, queue }));
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-risky-deploy/answer') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      answerRequests.push(payload);
      decisionState = 'answered';
      await route.fulfill(
        jsonResponse({
          status: 'resolved',
          confirmRequest: {
            ...decisionItem,
            state: 'answered',
            userAnswer: payload.answer,
            answeredAt: nowSeconds,
          },
        }),
      );
      return;
    }

    if (
      pathname.endsWith('/confirm-requests/cr-risky-deploy/state') &&
      request.method() === 'POST'
    ) {
      const payload = request.postDataJSON();
      stateRequests.push(payload);
      decisionState = payload.state;
      await route.fulfill(
        jsonResponse({
          status: 'updated',
          confirmRequest: currentDecisionItem(),
        }),
      );
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

  includeDeepLinkPeer = true;
  const deepLinkPage = await context.newPage();
  await deepLinkPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions?confirmRequestId=cr-risky-deploy`,
    { waitUntil: 'domcontentloaded' },
  );
  await deepLinkPage.getByText('决策中心 (2)').waitFor({ timeout: 10000 });
  await deepLinkPage
    .getByText('已定位通知对应确认项')
    .waitFor({ timeout: 10000 });
  const firstCardQuestion = await deepLinkPage
    .locator('.decision-card')
    .first()
    .locator('.question-text')
    .innerText();
  assert.match(firstCardQuestion, /OpenClaw 继续查询生产部署状态/);
  await deepLinkPage
    .locator(
      '.decision-card.deep-link-target[data-request-id="cr-risky-deploy"]',
    )
    .waitFor({ timeout: 10000 });

  const missingLinkPage = await context.newPage();
  await missingLinkPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions?confirmRequestId=cr-already-handled`,
    { waitUntil: 'domcontentloaded' },
  );
  await missingLinkPage
    .getByText('通知对应确认项不在当前队列')
    .waitFor({ timeout: 10000 });

  includeDeepLinkPeer = false;
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__decisionCenterCopiedText = text;
        },
      },
    });
  });
  await page.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions`,
    {
      waitUntil: 'domcontentloaded',
    },
  );

  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page.getByText('审核上下文').waitFor({ timeout: 10000 });
  await page.getByText('可选项：批准执行 / 拒绝执行 / 需要更多上下文').waitFor({
    timeout: 10000,
  });

  failWatchRequests = true;
  await page.getByRole('button', { name: '刷新' }).click();
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  await page.getByText('部分队列刷新失败').waitFor({ timeout: 10000 });
  await page.getByText(/失败队列：待观察/).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '批准执行' }).waitFor({
    timeout: 10000,
  });

  failWatchRequests = false;
  await page.getByRole('button', { name: '重试全部' }).click();
  await page
    .getByText('部分队列刷新失败')
    .waitFor({ state: 'detached', timeout: 10000 });

  await page.locator('.evidence-chip').filter({ hasText: '动作 ·' }).waitFor({
    timeout: 10000,
  });
  await page.getByText('另有 1 条').waitFor({ timeout: 10000 });

  await page.getByRole('button', { name: '复制审核包' }).click();
  await page.getByText('已复制审核包').waitFor({ timeout: 10000 });
  const copiedText = await page.evaluate(
    () => window.__decisionCenterCopiedText,
  );
  assert.match(copiedText, /OpenClaw 继续查询生产部署状态/);
  assert.match(copiedText, /可选项: 批准执行 \/ 拒绝执行 \/ 需要更多上下文/);
  assert.match(copiedText, /action:action-risky-deploy-approval-1/);

  await page.getByRole('button', { name: '稍后再决定' }).click();
  await page.getByText('决策中心 (0)').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /稍后决策/ }).click();
  await page.getByText('稍后处理上下文').waitFor({ timeout: 10000 });
  await page.getByText(/回到主队列/).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: '现在处理' }).click();
  await page.getByText('决策中心 (1)').waitFor({ timeout: 10000 });
  assert.deepEqual(stateRequests, [{ state: 'snoozed' }, { state: 'pending' }]);

  await page.getByRole('button', { name: '批准执行' }).click();
  await page.getByText('决策中心 (0)').waitFor({ timeout: 10000 });
  assert.deepEqual(answerRequests, [{ answer: 'approve' }]);

  failConfirmRequests = true;
  const errorPage = await context.newPage();
  await errorPage.goto(
    `chrome-extension://${extensionId}/memory-exploring.html#/decisions`,
    { waitUntil: 'domcontentloaded' },
  );
  await errorPage.getByText('决策中心暂时不可用').waitFor({ timeout: 10000 });
  await errorPage.getByText(/memory service unavailable/).waitFor({
    timeout: 10000,
  });

  console.log('verify-decision-center-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
