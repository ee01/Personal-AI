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
  path.join(os.tmpdir(), 'personal-ai-action-queue-'),
);
const nowSeconds = Math.floor(Date.now() / 1000);

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50, offset: 0 };
}

const fixtureActions = [
  {
    id: 'action-approval-high',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '复核生产部署状态',
    description: '读取生产部署系统前需要人工确认。',
    params: { mode: 'read', targetSystem: 'deployment' },
    riskLevel: 'high',
    confidence: 0.86,
    evidenceRefs: ['thread:release'],
    requiresApproval: true,
    state: 'pending',
    createdAt: nowSeconds - 600,
    executionMode: 'manual',
    priority: 9,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'reflection_thread',
    sourceRefId: 'thread-release',
    queueStatus: 'queued',
  },
  {
    id: 'action-running-stale',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '查询 Jira 变更记录',
    description: 'OpenClaw 正在查询 Jira。',
    params: { mode: 'read', targetSystem: 'jira' },
    riskLevel: 'medium',
    confidence: 0.72,
    evidenceRefs: [],
    requiresApproval: false,
    state: 'running',
    createdAt: nowSeconds - 3600,
    startedAt: nowSeconds - 2400,
    executionMode: 'auto',
    priority: 7,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'reflection_thread',
    sourceRefId: 'thread-jira',
    queueStatus: 'running',
  },
  {
    id: 'action-due-auto',
    type: 'notify_user',
    actionType: 'notify_user',
    title: '提醒查看发布风险',
    description: '自动提醒已经到期，等待下一次调度扫描。',
    params: {},
    riskLevel: 'low',
    confidence: 0.78,
    evidenceRefs: [],
    requiresApproval: false,
    state: 'pending',
    createdAt: nowSeconds - 1800,
    scheduledAt: nowSeconds - 300,
    executionMode: 'auto',
    priority: 6,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'reflection_thread',
    sourceRefId: 'thread-risk',
    queueStatus: 'queued',
  },
  {
    id: 'action-failed',
    type: 'ask_external_user',
    actionType: 'ask_external_user',
    title: '询问 PM owner',
    description: '目标解析失败，需要复核。',
    params: {},
    riskLevel: 'medium',
    confidence: 0.65,
    evidenceRefs: [],
    requiresApproval: false,
    state: 'pending',
    createdAt: nowSeconds - 1200,
    executionMode: 'auto',
    priority: 5,
    dependsOn: [],
    retryCount: 2,
    lastError: 'No unique RingCentral target matched.',
    sourceKind: 'outreach',
    sourceRefId: 'owner-gap',
    queueStatus: 'failed',
  },
  {
    id: 'action-succeeded',
    type: 'notify_user',
    actionType: 'notify_user',
    title: '已推送发布摘要',
    description: '通知已经发送。',
    params: {},
    riskLevel: 'low',
    confidence: 0.91,
    evidenceRefs: [],
    requiresApproval: false,
    state: 'executed',
    createdAt: nowSeconds - 2400,
    finishedAt: nowSeconds - 2300,
    executedAt: nowSeconds - 2300,
    executionMode: 'auto',
    priority: 4,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'notification',
    sourceRefId: 'release-summary',
    queueStatus: 'succeeded',
  },
  {
    id: 'action-delegation-succeeded',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '确认 Jira 发布状态',
    description: 'OpenClaw 已返回可验证外部事实。',
    params: { mode: 'read', targetSystem: 'jira' },
    riskLevel: 'low',
    confidence: 0.88,
    evidenceRefs: ['thread:release'],
    requiresApproval: false,
    state: 'executed',
    createdAt: nowSeconds - 2600,
    finishedAt: nowSeconds - 2500,
    executedAt: nowSeconds - 2500,
    executionMode: 'manual',
    priority: 4,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'openclaw',
    sourceRefId: 'ORB-123',
    queueStatus: 'succeeded',
    result: {
      status: 'success',
      summary: 'Jira 查询成功，ORB-123 当前处于 Ready for QA。',
      artifacts: [
        {
          kind: 'external_evidence',
          title: 'Jira ORB-123',
          content: 'ORB-123 status=Ready for QA, assignee=Esone Qiu.',
          metadata: {
            sourceSystem: 'jira',
            entityKey: 'ORB-123',
            verification: 'jira_api',
            observedFields: ['status', 'assignee'],
            observedAt: '2026-05-23T10:00:00Z',
          },
        },
      ],
      payload: {
        jiraKey: 'ORB-123',
        status: 'Ready for QA',
        assignee: 'Esone Qiu',
      },
      transcriptPath: 'delegations/thread-release-action-delegation-succeeded-1770000000.json',
    },
  },
];

function actionsForRequest(parsed) {
  const queueStatus = parsed.searchParams.get('queueStatus');
  const executionMode = parsed.searchParams.get('executionMode');
  let items = fixtureActions;
  if (queueStatus && queueStatus !== 'all') {
    items = items.filter((action) => action.queueStatus === queueStatus);
  }
  if (executionMode) {
    items = items.filter((action) => action.executionMode === executionMode);
  }
  return { items, total: items.length, limit: 50, offset: 0 };
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
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) return emptyList();
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
    const requestUrl = route.request().url();
    const parsed = new URL(requestUrl);
    const pathname = parsed.pathname;

    if (pathname.endsWith('/actions') && route.request().method() === 'GET') {
      await route.fulfill(jsonResponse(actionsForRequest(parsed)));
      return;
    }

    if (
      pathname.endsWith(
        '/user-files/delegations/thread-release-action-delegation-succeeded-1770000000.json',
      )
    ) {
      await route.fulfill(
        jsonResponse({
          filename: 'thread-release-action-delegation-succeeded-1770000000.json',
          content: JSON.stringify(
            {
              request: { model: 'openclaw:main', user: 'thread-release' },
              response: { output_text: '{"status":"success"}' },
              outputText: '{"status":"success"}',
            },
            null,
            2,
          ),
        }),
      );
      return;
    }

    await route.fulfill(jsonResponse(apiFallback(requestUrl)));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/actions`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByText('动作队列').first().waitFor({ timeout: 10000 });
  await page.locator('[aria-label="动作队列健康摘要"]').waitFor({ timeout: 10000 });
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '6' }).waitFor();
  await page.locator('.queue-stat', { hasText: '需要处理' }).locator('strong', { hasText: '3' }).waitFor();
  await page.locator('.queue-stat', { hasText: '执行中' }).locator('strong', { hasText: '1' }).waitFor();
  await page.locator('.queue-stat', { hasText: '失败/死信' }).locator('strong', { hasText: '1' }).waitFor();
  await page.getByText('有动作运行时间过长').waitFor({ timeout: 10000 });
  await page.getByText('动作已运行超过 30 分钟').waitFor({ timeout: 10000 });
  await page.getByText('确认 Jira 发布状态').waitFor({ timeout: 10000 });
  await page.getByText('成功获取外部事实').waitFor({ timeout: 10000 });
  await page.getByText('可验证 artifact 1 条').waitFor({ timeout: 10000 });
  await page.getByText('对象 ORB-123').waitFor({ timeout: 10000 });
  await page.getByText('字段 status, assignee').waitFor({ timeout: 10000 });
  await page.getByText('"jiraKey": "ORB-123"').waitFor({ timeout: 10000 });
  await page
    .locator('.transcript-panel', {
      hasText: 'thread-release-action-delegation-succeeded-1770000000.json',
    })
    .getByRole('button', { name: '展开' })
    .click();
  await page.getByText('"model": "openclaw:main"').waitFor({ timeout: 10000 });

  await page.locator('select.filter-select').first().selectOption('failed');
  await page.getByText('优先处理失败动作').waitFor({ timeout: 10000 });
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '1' }).waitFor();
  await page.getByText('No unique RingCentral target matched.').waitFor({ timeout: 10000 });

  await page.locator('select.filter-select').first().selectOption('cancelled');
  await page.getByText('当前筛选没有动作').waitFor({ timeout: 10000 });
  await page.getByText('当前来源、动作 ID、状态或执行模式没有命中').waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: '清除状态/模式筛选' }).click();
  await page.getByText('有动作运行时间过长').waitFor({ timeout: 10000 });
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '6' }).waitFor();

  console.log('verify-action-queue-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
