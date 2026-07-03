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
let approvalExecuteRequest = null;
let failNextActionListRequest = false;
let resolveApprovalExecuteStarted = () => {};
let resolveApprovalExecuteRelease = () => {};
const approvalExecuteStarted = new Promise((resolve) => {
  resolveApprovalExecuteStarted = resolve;
});
const approvalExecuteRelease = new Promise((resolve) => {
  resolveApprovalExecuteRelease = resolve;
});

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
    title: '更新生产部署状态',
    description: '写入生产部署系统前需要人工确认。',
    params: {
      mode: 'write',
      targetSystem: 'deployment',
      task: '请把生产部署状态更新为 paused。',
    },
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
    id: 'action-execute-request-fails',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '提交失败的外部写操作',
    description: '执行请求失败时不能伪装成 OpenClaw 已经开始。',
    params: {
      mode: 'write',
      targetSystem: 'drive',
      task: '请把复盘文档上传到 Drive。',
    },
    riskLevel: 'low',
    confidence: 0.76,
    evidenceRefs: ['thread:drive'],
    requiresApproval: false,
    state: 'pending',
    createdAt: nowSeconds - 900,
    executionMode: 'manual',
    priority: 6,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'reflection_thread',
    sourceRefId: 'thread-drive',
    queueStatus: 'queued',
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
    id: 'action-delegation-unverified',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '复核 Jira 标题结果',
    description: 'OpenClaw 返回了低可信外部结果。',
    params: { mode: 'read', targetSystem: 'jira' },
    riskLevel: 'medium',
    confidence: 0.7,
    evidenceRefs: ['thread:release'],
    requiresApproval: false,
    state: 'pending',
    createdAt: nowSeconds - 1500,
    finishedAt: nowSeconds - 1450,
    executionMode: 'manual',
    priority: 6,
    dependsOn: [],
    retryCount: 1,
    lastError: 'OpenClaw 返回了 success，但缺少可验证 artifact。',
    sourceKind: 'openclaw',
    sourceRefId: 'MTR-144628',
    queueStatus: 'failed',
    result: {
      status: 'error',
      summary: 'OpenClaw 返回了 success，但缺少可验证 artifact。',
      artifacts: [
        {
          kind: 'note',
          title: '检查结果',
          content: '标题已经正确。',
          metadata: {
            issueKey: 'MTR-144628',
          },
        },
      ],
      payload: {
        artifactValidation: 'missing_verifiable_artifact',
        jiraKey: 'MTR-144628',
      },
      transcriptPath: 'delegations/thread-release-action-delegation-unverified-1770000001.json',
    },
  },
  {
    id: 'action-delegation-capability-missing',
    type: 'delegate_openclaw',
    actionType: 'delegate_openclaw',
    title: '查询外部 Jira 能力',
    description: 'OpenClaw 当前无法完成 Jira 查询，需要恢复入口。',
    params: {
      mode: 'read',
      targetSystem: 'jira',
      task: '请查询 Jira 发布状态。',
    },
    riskLevel: 'medium',
    confidence: 0.74,
    evidenceRefs: ['thread:release'],
    requiresApproval: false,
    state: 'pending',
    createdAt: nowSeconds - 1700,
    finishedAt: nowSeconds - 1650,
    executionMode: 'manual',
    priority: 8,
    dependsOn: [],
    retryCount: 1,
    lastError: 'OpenClaw 当前未配置 Jira 相关能力。',
    sourceKind: 'openclaw',
    sourceRefId: 'JIRA-CAPABILITY',
    queueStatus: 'failed',
    result: {
      status: 'capability_missing',
      summary: 'OpenClaw 当前未配置 Jira 相关能力。',
      followUpActionIds: [
        'action-openclaw-recovery-notify',
        'action-openclaw-recovery-confirm',
      ],
      followUpActions: [
        {
          id: 'action-openclaw-recovery-notify',
          actionType: 'notify_user',
          title: '外部委派缺少能力: 查询外部 Jira 能力',
          queueStatus: 'succeeded',
          sourceKind: 'delegation_recovery',
          sourceRefId: 'action-delegation-capability-missing',
        },
        {
          id: 'action-openclaw-recovery-confirm',
          actionType: 'create_confirm_request',
          title: '需要处理 OpenClaw 配置后重试: 查询外部 Jira 能力',
          queueStatus: 'succeeded',
          sourceKind: 'delegation_recovery',
          sourceRefId: 'action-delegation-capability-missing',
        },
      ],
      transcriptPath: 'delegations/thread-release-action-delegation-capability-1770000002.json',
      payload: { configured: false },
    },
  },
  {
    id: 'action-openclaw-recovery-notify',
    type: 'notify_user',
    actionType: 'notify_user',
    title: '外部委派缺少能力: 查询外部 Jira 能力',
    description: 'OpenClaw 当前未配置 Jira 相关能力。',
    params: {},
    riskLevel: 'low',
    confidence: 0.74,
    evidenceRefs: ['action:action-delegation-capability-missing'],
    requiresApproval: false,
    state: 'executed',
    createdAt: nowSeconds - 1645,
    finishedAt: nowSeconds - 1640,
    executedAt: nowSeconds - 1640,
    executionMode: 'auto',
    priority: 8,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'delegation_recovery',
    sourceRefId: 'action-delegation-capability-missing',
    queueStatus: 'succeeded',
  },
  {
    id: 'action-openclaw-recovery-confirm',
    type: 'create_confirm_request',
    actionType: 'create_confirm_request',
    title: '需要处理 OpenClaw 配置后重试: 查询外部 Jira 能力',
    description: 'OpenClaw 当前未配置 Jira 相关能力。',
    params: {},
    riskLevel: 'medium',
    confidence: 0.74,
    evidenceRefs: ['action:action-delegation-capability-missing'],
    requiresApproval: false,
    state: 'executed',
    createdAt: nowSeconds - 1638,
    finishedAt: nowSeconds - 1630,
    executedAt: nowSeconds - 1630,
    executionMode: 'auto',
    priority: 8,
    dependsOn: [],
    retryCount: 0,
    sourceKind: 'delegation_recovery',
    sourceRefId: 'action-delegation-capability-missing',
    queueStatus: 'succeeded',
    result: {
      confirmRequestId: 'cr-openclaw-recovery',
      reusedExisting: false,
    },
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

    if (
      pathname.endsWith('/actions/action-execute-request-fails/execute') &&
      route.request().method() === 'POST'
    ) {
      failNextActionListRequest = true;
      await route.fulfill(
        jsonResponse({ error: 'temporary execute outage' }, 503),
      );
      return;
    }

    if (
      pathname.endsWith('/actions/action-approval-high/execute') &&
      route.request().method() === 'POST'
    ) {
      approvalExecuteRequest = route.request().postDataJSON();
      resolveApprovalExecuteStarted();
      await approvalExecuteRelease;
      await route.fulfill(
        jsonResponse({
          actionId: 'action-approval-high',
          actionType: 'delegate_openclaw',
          queueStatus: 'running',
        }),
      );
      return;
    }

    if (pathname.endsWith('/actions') && route.request().method() === 'GET') {
      if (failNextActionListRequest) {
        failNextActionListRequest = false;
        await route.fulfill(
          jsonResponse({ error: 'temporary action queue outage' }, 503),
        );
        return;
      }
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
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '11' }).waitFor();
  await page.locator('.queue-stat', { hasText: '需要处理' }).locator('strong', { hasText: '5' }).waitFor();
  await page.locator('.queue-stat', { hasText: '执行中' }).locator('strong', { hasText: '1' }).waitFor();
  await page.locator('.queue-stat', { hasText: '失败/死信' }).locator('strong', { hasText: '3' }).waitFor();
  const attentionReceipt = page.locator('[aria-label="动作队列处理构成"]');
  await attentionReceipt.getByText('当前需要处理的动作已拆分').waitFor({ timeout: 10000 });
  await attentionReceipt.getByText('5 条').waitFor({ timeout: 10000 });
  await attentionReceipt.getByText('不会执行、批准、重试或取消任何动作').waitFor({ timeout: 10000 });
  await attentionReceipt.locator('.attention-breakdown-row', { hasText: '失败/死信' }).locator('strong', { hasText: '3' }).waitFor();
  await attentionReceipt.locator('.attention-breakdown-row', { hasText: '已到期自动动作' }).locator('strong', { hasText: '1' }).waitFor();
  await attentionReceipt.locator('.attention-breakdown-row', { hasText: '待人工确认' }).locator('strong', { hasText: '1' }).waitFor();
  await attentionReceipt.getByText('口径：当前可见筛选结果').waitFor({ timeout: 10000 });
  await attentionReceipt.getByText('边界：只读统计').waitFor({ timeout: 10000 });
  failNextActionListRequest = true;
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/actions') &&
        response.request().method() === 'GET' &&
        response.status() === 503,
    ),
    page.locator('.refresh-btn').click(),
  ]);
  await page.getByText('当前显示上次成功快照').waitFor({ timeout: 10000 });
  await page.getByText('当前服务状态未确认').waitFor({ timeout: 10000 });
  await page.getByText('刷新动作队列失败，已保留上次快照').waitFor({ timeout: 10000 });
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '11' }).waitFor();
  await attentionReceipt.getByText('上次成功快照的处理构成').waitFor({ timeout: 10000 });
  await attentionReceipt.getByText('快照：上次成功读取').waitFor({ timeout: 10000 });
  const executeFailureCard = page.locator('.action-card', { hasText: '提交失败的外部写操作' });
  await executeFailureCard.getByText('外部写操作将由 OpenClaw 接管').waitFor({ timeout: 10000 });
  await executeFailureCard.getByText('范围：drive').waitFor({ timeout: 10000 });
  const failedExecuteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/actions/action-execute-request-fails/execute') &&
      response.request().method() === 'POST' &&
      response.status() === 503,
  );
  await executeFailureCard.getByRole('button', { name: '执行' }).click();
  await failedExecuteResponse;
  await executeFailureCard.getByText('OpenClaw 写操作执行请求失败').waitFor({ timeout: 10000 });
  await executeFailureCard.getByText('Memory Service 没有确认接收这次执行请求').waitFor({ timeout: 10000 });
  await executeFailureCard.getByText('本页不会把它标成 running').waitFor({ timeout: 10000 });
  await executeFailureCard.locator('.badge.queued', { hasText: 'queued' }).waitFor({ timeout: 10000 });
  assert.equal(await executeFailureCard.locator('.running-box').count(), 0);
  await page.locator('.action-card', { hasText: '更新生产部署状态' }).waitFor({ timeout: 10000 });
  const approvalCard = page.locator('.action-card', { hasText: '更新生产部署状态' });
  await approvalCard.getByText('委派预检').waitFor({ timeout: 10000 });
  await approvalCard.getByText('写操作会先停在人工确认').waitFor({ timeout: 10000 });
  await approvalCard.getByText('范围：deployment').waitFor({ timeout: 10000 });
  await approvalCard.getByText('模式：写操作').waitFor({ timeout: 10000 });
  await approvalCard.getByText('审批：待人工确认').waitFor({ timeout: 10000 });
  await approvalCard.getByText('确认前核对外部写操作').waitFor({ timeout: 10000 });
  await approvalCard.getByText('这不是 Jira、Drive、部署等外部系统已经完成的证明').waitFor({ timeout: 10000 });
  await approvalCard.getByText('OpenClaw：写操作').waitFor({ timeout: 10000 });
  await approvalCard.getByText('目标：deployment').waitFor({ timeout: 10000 });
  await approvalCard.getByText('结果证明：artifact / transcript / 队列状态').waitFor({ timeout: 10000 });
  await approvalCard.getByText('批准：点击后才写入').waitFor({ timeout: 10000 });
  const executeResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/actions/action-approval-high/execute') &&
      response.request().method() === 'POST',
  );
  await page
    .locator('.action-card', { hasText: '更新生产部署状态' })
    .getByRole('button', { name: '确认并执行' })
    .click();
  await approvalExecuteStarted;
  await approvalCard.getByText('操作提交中').waitFor({ timeout: 10000 });
  await approvalCard.getByText('确认与执行请求正在提交').waitFor({
    timeout: 10000,
  });
  await approvalCard
    .getByText('当前卡片仍是上次读取的队列快照')
    .waitFor({ timeout: 10000 });
  await approvalCard.getByText('状态：等待服务确认').waitFor({ timeout: 10000 });
  await approvalCard.getByText('队列快照：queued').waitFor({ timeout: 10000 });
  await approvalCard.getByText('批准：尚未确认写入').waitFor({ timeout: 10000 });
  assert.equal(await approvalCard.locator('.running-box').count(), 0);
  resolveApprovalExecuteRelease();
  await executeResponse;
  assert.equal(approvalExecuteRequest?.approve, true);
  await approvalCard.getByText('操作回执').waitFor({ timeout: 10000 });
  await approvalCard.getByText('已确认并提交 OpenClaw 执行').waitFor({
    timeout: 10000,
  });
  await approvalCard.getByText('服务端状态：running').waitFor({
    timeout: 10000,
  });
  await approvalCard.getByText('批准：已随请求提交').waitFor({
    timeout: 10000,
  });
  await approvalCard.getByText('结论：等待 artifact / transcript').waitFor({
    timeout: 10000,
  });
  await page.getByText('有动作运行时间过长').waitFor({ timeout: 10000 });
  await page.getByText('动作已运行超过 30 分钟').waitFor({ timeout: 10000 });
  const runningCard = page.locator('.action-card', { hasText: '查询 Jira 变更记录' });
  await runningCard.getByText('正在等待 OpenClaw 最终结果').waitFor({ timeout: 10000 });
  await runningCard.getByText('恢复：自动刷新 / stale 转 dead_letter').waitFor({ timeout: 10000 });
  const dueNotificationCard = page.locator('.action-card', { hasText: '提醒查看发布风险' });
  await dueNotificationCard.getByText('执行范围', { exact: true }).waitFor({ timeout: 10000 });
  await dueNotificationCard.getByText('到期自动动作范围').waitFor({ timeout: 10000 });
  await dueNotificationCard
    .getByText('执行会把这条通知交给 Memory Service 的通知通道')
    .waitFor({ timeout: 10000 });
  await dueNotificationCard.getByText('类型：通知提醒').waitFor({ timeout: 10000 });
  await dueNotificationCard.getByText('完成：等待结果回执').waitFor({ timeout: 10000 });
  const unverifiedCard = page.locator('.action-card', { hasText: '复核 Jira 标题结果' });
  await unverifiedCard.getByText('证据校验回执').waitFor({ timeout: 10000 });
  await unverifiedCard.getByText('OpenClaw 返回缺少可验证 artifact').waitFor({ timeout: 10000 });
  await unverifiedCard.getByText('写回：已阻断').waitFor({ timeout: 10000 });
  await unverifiedCard.getByText('恢复：改写任务或补齐 artifact 后重试').waitFor({ timeout: 10000 });
  await unverifiedCard.getByText('未验证 artifact 1 条').waitFor({ timeout: 10000 });
  const capabilityCard = page.locator('.action-card', { hasText: '查询外部 Jira 能力' });
  await capabilityCard.getByText('恢复路径回执').waitFor({ timeout: 10000 });
  await capabilityCard.getByText('已派生 OpenClaw 配置恢复入口').waitFor({ timeout: 10000 });
  await capabilityCard
    .getByText('不会自动重试原 OpenClaw 动作')
    .waitFor({ timeout: 10000 });
  await capabilityCard.getByText('恢复入口：2').waitFor({ timeout: 10000 });
  await capabilityCard.getByText('明细：可跳转到派生动作').waitFor({ timeout: 10000 });
  await capabilityCard.getByText('通知恢复动作：外部委派缺少能力').waitFor({ timeout: 10000 });
  const confirmRecoveryLink = capabilityCard.getByRole('link', {
    name: /决策中心确认动作：需要处理 OpenClaw 配置后重试/,
  });
  await confirmRecoveryLink.waitFor({ timeout: 10000 });
  const confirmRecoveryHref = await confirmRecoveryLink.getAttribute('href');
  assert.match(confirmRecoveryHref || '', /actionId=action-openclaw-recovery-confirm/);
  await page.getByText('确认 Jira 发布状态').waitFor({ timeout: 10000 });
  const succeededDelegationCard = page.locator('.action-card', { hasText: '确认 Jira 发布状态' });
  await succeededDelegationCard.getByText('结果已回流，按 artifact / transcript 审计').waitFor({ timeout: 10000 });
  await succeededDelegationCard.getByText('恢复：结果已回流').waitFor({ timeout: 10000 });
  await page.getByText('成功获取外部事实').waitFor({ timeout: 10000 });
  await succeededDelegationCard.getByText('可验证 artifact 1 条').waitFor({ timeout: 10000 });
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
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '3' }).waitFor();
  await attentionReceipt.getByText('当前需要处理的动作已拆分').waitFor({ timeout: 10000 });
  await attentionReceipt.getByText('3 条').waitFor({ timeout: 10000 });
  await attentionReceipt.locator('.attention-breakdown-row', { hasText: '失败/死信' }).locator('strong', { hasText: '3' }).waitFor();
  await page.getByText('No unique RingCentral target matched.').waitFor({ timeout: 10000 });
  const failedOutreachCard = page.locator('.action-card', { hasText: '询问 PM owner' });
  await failedOutreachCard.getByText('执行范围', { exact: true }).waitFor({ timeout: 10000 });
  await failedOutreachCard.getByText('重试前确认执行范围').waitFor({ timeout: 10000 });
  await failedOutreachCard
    .getByText('重试只会把动作重新放回队列')
    .waitFor({ timeout: 10000 });
  await failedOutreachCard.getByText('类型：主动询问').waitFor({ timeout: 10000 });
  await failedOutreachCard.getByText('重试：只重新入队').waitFor({ timeout: 10000 });
  await page.getByText('OpenClaw 返回缺少可验证 artifact').waitFor({ timeout: 10000 });

  await page.locator('select.filter-select').first().selectOption('cancelled');
  await page.getByText('当前筛选没有动作').waitFor({ timeout: 10000 });
  await page.getByText('当前来源、动作 ID、状态或执行模式没有命中').waitFor({
    timeout: 10000,
  });
  await page.getByRole('button', { name: '清除状态/模式筛选' }).click();
  await page.getByText('有动作运行时间过长').waitFor({ timeout: 10000 });
  await page.locator('.queue-stat', { hasText: '当前结果' }).locator('strong', { hasText: '11' }).waitFor();

  console.log('verify-action-queue-e2e: ok');
} finally {
  await context.close();
  await fs.rm(userDataDir, { recursive: true, force: true });
}
