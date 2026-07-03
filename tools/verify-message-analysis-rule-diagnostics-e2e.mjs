import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');
const memoryBaseUrl = 'http://127.0.0.1:49211/api/v1';
const defaultMemoryBaseUrl = 'http://localhost:3210/api/v1';
const diagnosticsKey = 'messageAnalysisRuleDiagnostics';
const deliveryReceiptKey = 'messageAnalysisDeliveryReceipt';

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'message-analysis-rule-diagnostics-e2e-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
    serviceWorker,
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(
      errors,
      [],
      `Message Analysis rule diagnostics page errors: ${errors.join('; ')}`,
    );
  };
}

async function expandTopicCard(card) {
  const summary = card.locator('.topic-summary-row');
  if ((await summary.count()) > 0) {
    await summary.click({ timeout: 5000 });
  }
}

function buildRuntimeStatusFixture(now) {
  const baselineSeconds = Math.floor((now - 60 * 60 * 1000) / 1000);
  return {
    items: [
      {
        template: {
          id: 'template-release-risk',
          sourceKind: 'scheduled_message',
          sourceRefId: 'template-release-risk',
          title: 'Release risk follow-up',
          questionTemplate: '请确认 Release blocker 是否解除。',
          contextTemplate: '如果仍有风险，请补充 owner 和 ETA。',
          targetType: 'group',
          targetRef: 'Release Risk Room',
          enabled: true,
          syncState: 'synced',
          lastSessionId: 'session-release-risk',
          createdAt: baselineSeconds,
          updatedAt: baselineSeconds,
        },
        latestSession: {
          id: 'session-release-risk',
          templateId: 'template-release-risk',
          targetType: 'group',
          targetRef: 'release-risk-room',
          targetResolvedLabel: 'Release Risk Room',
          targetResolvedChatId: 'chat-release-risk',
          renderedQuestion: '请确认 Release blocker 是否解除。',
          renderedContext: '如果仍有风险，请补充 owner 和 ETA。',
          status: 'waiting_reply',
          requiresApproval: false,
          followupCount: 0,
          maxFollowup: 2,
          sentChatId: 'chat-release-risk',
          sentPostId: 'post-release-risk',
          createdAt: baselineSeconds,
          updatedAt: baselineSeconds,
        },
      },
      {
        template: {
          id: 'template-ops-preflight',
          sourceKind: 'scheduled_message',
          sourceRefId: 'template-ops-preflight',
          title: 'Ops preflight probe',
          questionTemplate: '谁能确认今晚排期是否已冻结？',
          contextTemplate: '只需要补充是否冻结和下一步 owner。',
          targetType: 'group',
          targetRef: 'Ops Triage',
          enabled: true,
          syncState: 'synced',
          createdAt: baselineSeconds - 3600,
          updatedAt: baselineSeconds - 3600,
        },
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
  };
}

function buildEmptyRuntimeStatusFixture() {
  return {
    items: [],
    total: 0,
    limit: 200,
    offset: 0,
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;
  const now = Date.now();

  let runtimeStatusFixture = buildRuntimeStatusFixture(now);
  let runtimeStatusFailure = false;
  const fulfillRuntimeStatus = async (route) => {
    if (runtimeStatusFailure) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'runtime status unavailable' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(runtimeStatusFixture),
    });
  };
  await context.route(
    `${memoryBaseUrl}/outreach/templates/runtime-status**`,
    fulfillRuntimeStatus,
  );
  await context.route(
    `${defaultMemoryBaseUrl}/outreach/templates/runtime-status**`,
    fulfillRuntimeStatus,
  );
  await context.route(
    '**/api/v1/outreach/templates/runtime-status**',
    fulfillRuntimeStatus,
  );

  await serviceWorker.evaluate(
    async ({ baseUrl, diagnosticsKey, deliveryReceiptKey, now }) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        envConfig: {
          MEMORY_SERVICE_BASE_URL: baseUrl,
          OPENCLAW_ENABLED: false,
        },
        userinfo: {
          username: 'diagnostic.verify',
          fullName: 'Diagnostic Verify',
        },
        taskSchedulerStates: {
          message_analysis: { enabled: true },
        },
        concernedItems: [
          {
            id: 'release-only',
            text: 'Release blockers',
            expiredAt: 0,
            notifyMethod: 'bot',
            filterGroup: 'Release Chat',
          },
          {
            id: 'daily-digest-only',
            text: 'Digest-only operational notes',
            expiredAt: 0,
            notifyMethod: 'bot,chrome',
            filterGroup: 'Ops Triage',
            digestConfig: {
              enabled: true,
              frequency: 'daily',
              preferredHour: 9,
            },
          },
          {
            id: 'silent-memory-only',
            text: 'Quiet memory-only facts',
            expiredAt: 0,
            filterSender: 'Morgan Lee',
          },
          {
            id: 'follow-thread-with-stale-digest',
            text: 'Track follow-up on customer migration blockers',
            expiredAt: 0,
            notifyMethod: 'bot,chrome',
            filterGroup: 'Customer Migration',
            followThread: true,
            digestConfig: {
              enabled: true,
              frequency: 'weekly',
              preferredDayOfWeek: 2,
              preferredHour: 10,
            },
          },
          {
            id: 'manual-auto-reply-review',
            text: 'Reply to support handoff requests',
            expiredAt: 0,
            filterGroup: 'Support Handoff',
            autoReply: true,
            autoReplyConfig: {
              enabled: true,
              replyContent: 'I will take a look and follow up.',
              useAIGenerate: false,
              reviewMode: 'manual',
            },
          },
          {
            id: 'linked-action-draft',
            text: 'Create a follow-up task when launch blockers appear',
            expiredAt: 0,
            filterGroup: 'Launch Room',
            automationPrompt: 'Create a follow-up task with owner and due date',
            automationRequiresApproval: true,
          },
        ],
        [diagnosticsKey]: [
          {
            id: `manual:release-only:post-out-of-scope-1:${now}`,
            status: 'scope_rejected',
            ruleRef: 'manual:release-only',
            ruleText: 'Release blockers',
            reason:
              '群组不在范围：期望 Release Chat，实际 daily-standup / Daily Standup',
            reasons: [
              '群组不在范围：期望 Release Chat，实际 daily-standup / Daily Standup',
            ],
            sender: 'Priya',
            groupName: 'Daily Standup',
            groupId: 'daily-standup',
            postId: 'post-out-of-scope-1',
            datetime: new Date(now).toISOString(),
            capturedAt: now,
          },
        ],
        [deliveryReceiptKey]: {
          version: 1,
          status: 'partial',
          runMode: 'filter',
          source: 'manual',
          startedAt: now - 12_000,
          capturedAt: now,
          counters: {
            groupsAnalyzed: 2,
            analyzedMessages: 4,
            scopeRejected: 1,
            memoryWriteRequests: 3,
            memoryWritesAccepted: 2,
            memoryDuplicateSkips: 1,
            memoryWriteFailures: 0,
            immediateNotificationAttempts: 1,
            immediateNotificationFailures: 1,
            digestQueueEntries: 1,
            autoReplyHandled: 1,
            autoReplySkipped: 1,
            followThreadUpdates: 0,
            followThreadFailures: 0,
            automationPlanRequests: 1,
            automationActionsCreated: 0,
            automationPlanSkipped: 0,
            automationPlanFailures: 0,
            automationPlanPaused: 0,
          },
          notes: [
            '自动答复未入队：规则「Reply to support handoff requests」已命中，但定时消息尚未初始化。',
          ],
        },
      });
    },
    { baseUrl: memoryBaseUrl, diagnosticsKey, deliveryReceiptKey, now },
  );

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/topic-modal.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h2', { hasText: '记忆入口规则' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.topic-item', { hasText: 'Release blockers' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('button', { hasText: /^▶ 立即分析最近/ })
    .waitFor({ timeout: 5000 });

  const deliveryReceipt = page.locator('.message-analysis-delivery-receipt');
  await deliveryReceipt.locator('text=本轮分发统计').waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.locator('text=手动 · 普通 filter').waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.locator('text=部分完成').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=分析消息 4').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=写入请求 3').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=已接收写入 2').waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.locator('text=重复跳过 1').waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.locator('text=即时通知 1').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=摘要入队 1').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=自动答复入队 1').waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.getByText('自动答复未入队 1', { exact: true }).waitFor({
    timeout: 5000,
  });
  await deliveryReceipt.locator('text=联动规划 1').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=范围拦截 1').waitFor({ timeout: 5000 });
  await deliveryReceipt.locator('text=下游失败 1').waitFor({
    timeout: 5000,
  });

  const releaseCard = page.locator('.topic-item', {
    hasText: 'Release blockers',
  });
  await expandTopicCard(releaseCard);
  await releaseCard
    .locator('.scope-chip', { hasText: '群组：Release Chat' })
    .waitFor({ timeout: 5000 });
  await releaseCard
    .locator('.rule-delivery-receipt.notify', {
      hasText: '分发路径 · 即时通知',
    })
    .waitFor({ timeout: 5000 });
  await releaseCard
    .locator('.rule-delivery-receipt', {
      hasText: '立即通过 Glip 通知',
    })
    .waitFor({ timeout: 5000 });
  const digestCard = page.locator('.topic-item', {
    hasText: 'Digest-only operational notes',
  });
  await expandTopicCard(digestCard);
  await digestCard
    .locator('.rule-delivery-receipt.digest', {
      hasText: '分发路径 · 每日摘要',
    })
    .waitFor({ timeout: 5000 });
  await digestCard
    .locator('.rule-delivery-receipt', {
      hasText: '摘要会替代 Glip / Chrome 即时通知',
    })
    .waitFor({ timeout: 5000 });

  const followThreadCard = page.locator('.topic-item', {
    hasText: 'Track follow-up on customer migration blockers',
  });
  await expandTopicCard(followThreadCard);
  await followThreadCard
    .locator('.rule-delivery-receipt.followup', {
      hasText: '分发路径 · 关注后续通知',
    })
    .waitFor({ timeout: 5000 });
  await followThreadCard
    .locator('.rule-delivery-receipt', {
      hasText: '后续相关消息优先按关注后续走 Glip / Chrome',
    })
    .waitFor({ timeout: 5000 });
  const followThreadSafetyTitle = await followThreadCard
    .locator('.rule-badge[class*="safety-"]')
    .getAttribute('title');
  assert.match(followThreadSafetyTitle || '', /关注后续通知/);
  assert.doesNotMatch(followThreadSafetyTitle || '', /即时通知/);

  const silentCard = page.locator('.topic-item', {
    hasText: 'Quiet memory-only facts',
  });
  await expandTopicCard(silentCard);
  await silentCard
    .locator('.rule-delivery-receipt.silent', {
      hasText: '分发路径 · 静默入库',
    })
    .waitFor({ timeout: 5000 });
  await silentCard
    .locator('.rule-delivery-receipt', {
      hasText: '不发即时通知，也不进入定时摘要',
    })
    .waitFor({ timeout: 5000 });

  await page
    .locator('button', { hasText: '添加规则' })
    .click({ timeout: 5000 });
  await page
    .locator('.add-topic-form .rule-prompt-input')
    .fill('Multi-scope smoke rule');
  await page.locator('#new-filter-group').fill('AI, Release Chat');
  await page.locator('#new-filter-sender').fill('Morgan Lee; Alice');
  const newRuleReceipt = page.locator('.new-rule-receipt');
  await newRuleReceipt
    .locator('text=写入记忆')
    .waitFor({ timeout: 5000 });
  await newRuleReceipt
    .locator('text=范围：AI 或 Release Chat / Morgan Lee 或 Alice')
    .waitFor({ timeout: 5000 });
  await newRuleReceipt
    .locator('text=范围词较短')
    .waitFor({ timeout: 5000 });
  await page
    .locator('.add-topic-form .form-buttons button', { hasText: '取消' })
    .click({ timeout: 5000 });

  const autoReplyCard = page.locator('.topic-item', {
    hasText: 'Reply to support handoff requests',
  });
  await expandTopicCard(autoReplyCard);
  await autoReplyCard
    .locator('.supporting-panel', {
      hasText: '自动答复草稿',
    })
    .waitFor({ timeout: 5000 });
  await autoReplyCard
    .locator('.supporting-panel', {
      hasText: 'I will take a look and follow up.',
    })
    .waitFor({ timeout: 5000 });
  await autoReplyCard.getByRole('button', { name: /编辑/ }).click();
  const autoReplyScopeReceipt = page.locator('.auto-reply-rule-scope-receipt');
  await autoReplyScopeReceipt
    .locator('text=自动答复规则边界')
    .waitFor({ timeout: 5000 });
  await autoReplyScopeReceipt
    .locator('text=命中范围：发送人 不限发送人；群组 Support Handoff。')
    .waitFor({ timeout: 5000 });
  await autoReplyScopeReceipt
    .locator('text=不会回扫历史消息、不会把当前页面草稿插入 RingCentral，也不会直接向任何人发送')
    .waitFor({ timeout: 5000 });
  await autoReplyScopeReceipt
    .locator('text=后续新消息命中后只新建 PendingReview 行')
    .waitFor({ timeout: 5000 });
  await page
    .locator('.auto-reply-mode-receipt', {
      hasText: '如果固定文本为空，本次会跳过自动答复，不会入队空回复。',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.topic-edit-form .new-rule-receipt', {
      hasText: '范围：Support Handoff / 所有发送人',
    })
    .waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '取消' }).click();

  const linkedActionCard = page.locator('.topic-item', {
    hasText: 'Create a follow-up task when launch blockers appear',
  });
  await expandTopicCard(linkedActionCard);
  await linkedActionCard
    .locator('.supporting-panel', {
      hasText: '联动操作',
    })
    .waitFor({ timeout: 5000 });
  await linkedActionCard
    .locator('.supporting-panel', {
      hasText: 'OpenClaw 未配置',
    })
    .waitFor({ timeout: 5000 });
  await linkedActionCard.getByRole('button', { name: /编辑/ }).click();
  await page
    .locator('.topic-edit-form .automation-disclosure-btn', {
      hasText: '联动操作（OpenClaw）',
    })
    .click({ timeout: 5000 });
  const linkedActionExecutionPreview = page.locator(
    '.linked-action-execution-preview',
    {
      hasText: '保存后：待激活动作计划',
    },
  );
  await linkedActionExecutionPreview.waitFor({ timeout: 5000 });
  await linkedActionExecutionPreview
    .locator('text=触发：来自 Launch Room 的消息')
    .waitFor({ timeout: 5000 });
  await linkedActionExecutionPreview
    .locator('text=保存只写本机手动规则')
    .waitFor({ timeout: 5000 });
  await linkedActionExecutionPreview
    .locator('text=连接 OpenClaw 前不会执行外部写操作')
    .waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: '取消' }).click();

  const diagnostic = page.locator('.rule-diagnostic', {
    hasText: '最近拦截',
  });
  await diagnostic.waitFor({ timeout: 15000 });
  await diagnostic.locator('text=群组不在范围').waitFor({ timeout: 5000 });
  const diagnosticContext = diagnostic.locator('.rule-diagnostic-context');
  await diagnosticContext
    .locator('text=Daily Standup')
    .waitFor({ timeout: 5000 });
  await diagnosticContext.locator('text=Priya').waitFor({ timeout: 5000 });

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      userinfo: {
        username: 'diagnostic.verify',
        fullName: 'Diagnostic Verify',
      },
    });
  });

  await page.evaluate(({ deliveryReceiptKey }) => {
    chrome.tabs.query = async () => [
      {
        id: 7788,
        url: 'https://app.ringcentral.com/messages',
      },
    ];
    chrome.tabs.sendMessage = (_tabId, _message, callback) => {
      callback({
        success: true,
        data: [
          {
            type: 'message',
            groupName: 'Release Chat',
            groupId: 'release-chat',
            posts: [
              {
                id: 'manual-success-post',
                creator: 'Priya',
                time: new Date().toISOString(),
                text: 'Release blocker looks ready for review.',
              },
            ],
          },
        ],
      });
    };
    chrome.runtime.sendMessage = async (message) => {
      if (message?.type === 'MESSAGE_DEALING') {
        const now = Date.now();
        await chrome.storage.local.set({
          ollamaAnalysisProgress: {
            total: 1,
            lastAnalyzedIndex: 1,
            lastAnalyzedTime: new Date(now).toISOString(),
          },
          [deliveryReceiptKey]: {
            version: 1,
            status: 'completed',
            runMode: 'filter',
            source: 'manual',
            startedAt: now - 1000,
            capturedAt: now,
            counters: {
              groupsAnalyzed: 1,
              analyzedMessages: 1,
              scopeRejected: 0,
              memoryWriteRequests: 1,
              memoryWritesAccepted: 1,
              memoryDuplicateSkips: 0,
              memoryWriteFailures: 0,
              immediateNotificationAttempts: 0,
              immediateNotificationFailures: 0,
              digestQueueEntries: 0,
              autoReplyHandled: 0,
              autoReplySkipped: 0,
              followThreadUpdates: 0,
              followThreadFailures: 0,
              automationPlanRequests: 0,
              automationActionsCreated: 0,
              automationPlanSkipped: 0,
              automationPlanFailures: 0,
              automationPlanPaused: 0,
            },
            notes: [],
          },
        });
        return { success: true, message: 'manual analysis complete' };
      }
      return { success: true };
    };
  }, { deliveryReceiptKey });

  await page
    .locator('button', { hasText: '立即分析最近' })
    .click({ timeout: 5000 });
  await page
    .locator('.rule-operation-toast.success', {
      hasText: '立即分析完成',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.rule-operation-toast.success', {
      hasText: '以分发回执与各队列状态为准',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('button', { hasText: /^▶ 立即分析最近/ })
    .waitFor({ timeout: 5000 });

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      userinfo: {
        username: 'diagnostic.verify',
        fullName: '',
      },
    });
  });

  await page.evaluate(() => {
    chrome.tabs.query = async () => [
      {
        id: 7788,
        url: 'https://app.ringcentral.com/messages',
      },
    ];
    chrome.tabs.sendMessage = (_tabId, _message, callback) => {
      callback({ success: true, data: null });
    };
  });

  await page
    .locator('button', { hasText: '立即分析最近' })
    .click({ timeout: 5000 });
  await page
    .locator('.rule-operation-toast.error', {
      hasText: '立即分析失败',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.rule-operation-toast.error', {
      hasText: 'RingCentral PWA 已打开并刷新后重试',
    })
    .waitFor({ timeout: 5000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.locator('button', { hasText: '导出规则' }).click({ timeout: 5000 });
  await downloadPromise;
  const exportReceipt = page.locator('.rule-export-receipt');
  await exportReceipt
    .locator('text=导出规则回执')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=已导出 6 条本机手动规则')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=导出文件只包含你手动维护的记忆入口规则')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=系统观察规则、Outreach 会话和自我反思临时观察不会进入 XML')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=导出只读取本机 Chrome storage')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=不会自动分析历史消息、发送通知、创建 RuntimeAction 或执行外部写操作')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=OpenClaw 未连接：导出中有 1 条联动操作在本机仍是待激活')
    .waitFor({ timeout: 5000 });
  await exportReceipt
    .locator('text=Memory Service 已配置，但导出不会同步、删除、恢复或覆盖 Memory Service 里的记忆')
    .waitFor({ timeout: 5000 });

  const importXmlPath = path.join(
    launched.userDataDir,
    'message-rules-import.xml',
  );
  await fs.writeFile(
    importXmlPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<topics>
  <topic>
    <id> imported-silent </id>
    <text> Imported quiet memory </text>
    <expiredAt>0</expiredAt>
    <filterSender> Morgan Lee </filterSender>
    <filterGroup>   </filterGroup>
  </topic>
  <topic>
    <id>imported-linked-action</id>
    <text>Imported launch blocker automation</text>
    <expiredAt>0</expiredAt>
    <notifyMethod>bot</notifyMethod>
    <filterGroup> Launch Room </filterGroup>
    <automationPrompt> Create a follow-up task with owner and due date </automationPrompt>
    <automationRequiresApproval>false</automationRequiresApproval>
  </topic>
  <topic>
    <id>imported-expired-alert</id>
    <text>Imported expired alert</text>
    <expiredAt>${now - 60_000}</expiredAt>
    <notifyMethod>bot</notifyMethod>
    <filterGroup>Expired Room</filterGroup>
  </topic>
</topics>`,
    'utf8',
  );

  await page.locator('input[type="file"]').setInputFiles(importXmlPath);
  const importReceipt = page.locator('.rule-import-receipt');
  await importReceipt
    .locator('text=导入规则回执')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=从 XML 导入 3 条手动规则')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=已替换 6 条本机手动规则')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=系统观察规则没有导入或覆盖')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=导入只替换手动规则列表，不会自动分析历史消息')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=OpenClaw 未连接：1 条联动操作先保存为待激活')
    .waitFor({ timeout: 5000 });
  await importReceipt
    .locator('text=Memory Service 已配置；导入本身只写本机规则')
    .waitFor({ timeout: 5000 });
  await page
    .locator('.topic-item', { hasText: 'Imported quiet memory' })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.topic-item', { hasText: 'Imported launch blocker automation' })
    .waitFor({ timeout: 5000 });
  const importedStorage = await page.evaluate(async () => {
    const result = await chrome.storage.local.get('concernedItems');
    return result.concernedItems || [];
  });
  const importedSilentRule = importedStorage.find(
    (rule) => rule.id === 'imported-silent',
  );
  const importedLinkedRule = importedStorage.find(
    (rule) => rule.id === 'imported-linked-action',
  );
  assert.equal(importedSilentRule?.text, 'Imported quiet memory');
  assert.equal(importedSilentRule?.filterSender, 'Morgan Lee');
  assert.equal(importedSilentRule?.filterGroup, undefined);
  assert.equal(importedLinkedRule?.filterGroup, 'Launch Room');
  assert.equal(
    importedLinkedRule?.automationPrompt,
    'Create a follow-up task with owner and due date',
  );
  const expiredCard = page.locator('.topic-item', {
    hasText: 'Imported expired alert',
  });
  await expiredCard.waitFor({ timeout: 5000 });
  await expandTopicCard(expiredCard);
  await expiredCard
    .locator('.rule-badge.expired', {
      hasText: '已过期',
    })
    .waitFor({ timeout: 5000 });
  await expiredCard
    .locator('.rule-inactive-receipt.expired', {
      hasText: '已过期规则',
    })
    .waitFor({ timeout: 5000 });
  await expiredCard
    .locator('.rule-inactive-receipt.expired', {
      hasText: '不会继续自动捕获新消息',
    })
    .waitFor({ timeout: 5000 });
  await expiredCard
    .locator('.rule-inactive-receipt.expired', {
      hasText: '不会写入记忆、发送通知、进入摘要、生成自动答复、关注后续或创建联动操作',
    })
    .waitFor({ timeout: 5000 });
  assert.equal(
    await page.locator('.topic-item', { hasText: 'Release blockers' }).count(),
    0,
    'XML import should replace previous manual rules rather than append them',
  );

  assertNoPageErrors();
  console.log('verify-message-analysis-rule-diagnostics-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
  if (launched?.userDataDir) {
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
}
