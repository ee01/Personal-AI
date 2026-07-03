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
const memoryBaseUrl = 'http://127.0.0.1:49212/api/v1';
const defaultMemoryBaseUrl = 'http://localhost:3210/api/v1';

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'linked-action-preview-receipt-e2e-'),
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
      `Linked action preview receipt page errors: ${errors.join('; ')}`,
    );
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  const fulfillEmptyRuntimeStatus = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        total: 0,
        limit: 200,
        offset: 0,
      }),
    });
  };
  await context.route(
    `${memoryBaseUrl}/outreach/templates/runtime-status**`,
    fulfillEmptyRuntimeStatus,
  );
  await context.route(
    `${defaultMemoryBaseUrl}/outreach/templates/runtime-status**`,
    fulfillEmptyRuntimeStatus,
  );
  await context.route(
    '**/api/v1/outreach/templates/runtime-status**',
    fulfillEmptyRuntimeStatus,
  );

  let previewPayload = null;
  const fulfillAutomationPreview = async (route) => {
    previewPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        canPlan: true,
        actionFamily: 'openclaw_delegation',
        actions: [
          {
            actionType: 'delegate_openclaw',
            title: 'Create launch blocker follow-up task',
            targetSystem: 'OpenClaw',
            executionMode: 'manual',
            requiresApproval: true,
          },
        ],
        warnings: [
          {
            code: 'delegated_to_openclaw_black_box',
            severity: 'info',
            message:
              'Memory Service 没有确定性的内部执行器；实际能力以 OpenClaw 执行结果为准。',
          },
        ],
        suggestedPrompt:
          'Create a follow-up task only when owner and due date are explicit.',
        suggestionReason: '需要 owner、due date 和成功回执，避免模糊委派。',
      }),
    });
  };
  await context.route(
    `${memoryBaseUrl}/message-rules/preview`,
    fulfillAutomationPreview,
  );
  await context.route(
    `${defaultMemoryBaseUrl}/message-rules/preview`,
    fulfillAutomationPreview,
  );
  await context.route(
    '**/api/v1/message-rules/preview',
    fulfillAutomationPreview,
  );

  await serviceWorker.evaluate(async ({ baseUrl }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: baseUrl,
        OPENCLAW_ENABLED: false,
      },
      userinfo: {
        username: 'linked.preview.verify',
        fullName: 'Linked Preview Verify',
      },
      taskSchedulerStates: {
        message_analysis: { enabled: true },
      },
      concernedItems: [
        {
          id: 'linked-preview-rule',
          text: 'Create a follow-up task when launch blockers appear',
          expiredAt: 0,
          filterGroup: 'Launch Room',
          automationPrompt: 'Create a follow-up task with owner and due date',
          automationRequiresApproval: true,
        },
      ],
    });
  }, { baseUrl: memoryBaseUrl });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/topic-modal.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h2', { hasText: '记忆入口规则' }).waitFor({
    timeout: 15000,
  });

  const linkedActionCard = page.locator('.topic-item', {
    hasText: 'Create a follow-up task when launch blockers appear',
  });
  await linkedActionCard.waitFor({ timeout: 15000 });
  await linkedActionCard.locator('.topic-summary-row').click();
  await linkedActionCard
    .locator('.rule-card-top', { hasText: 'manual:linked-preview-rule' })
    .waitFor({ timeout: 5000 });
  await linkedActionCard.getByRole('button', { name: /编辑/ }).click();
  await page
    .locator('.topic-edit-form .automation-disclosure-btn', {
      hasText: '联动操作（OpenClaw）',
    })
    .click({ timeout: 5000 });
  await page
    .locator('.topic-edit-form .automation-config-body')
    .getByRole('button', { name: '预演并改进' })
    .click();

  const linkedActionPreviewReceipt = page.locator(
    '.topic-edit-form .automation-preview-receipt',
    {
      hasText: '预演结果回执',
    },
  );
  await linkedActionPreviewReceipt.waitFor({ timeout: 5000 });
  await linkedActionPreviewReceipt
    .locator('text=dry-run 可规划 1 个候选动作')
    .waitFor({ timeout: 5000 });
  await linkedActionPreviewReceipt
    .locator('text=样本：来自 Launch Room 的消息')
    .waitFor({ timeout: 5000 });
  await linkedActionPreviewReceipt
    .locator('text=候选动作 1 个，警告 1 条')
    .waitFor({ timeout: 5000 });
  await linkedActionPreviewReceipt
    .locator(
      'text=不会保存规则、不会创建 RuntimeAction、不会调用 OpenClaw、不会发送消息，也不会写外部系统',
    )
    .waitFor({ timeout: 5000 });
  await linkedActionPreviewReceipt
    .locator('text=执行路径继续按 Action Queue 批准 和 OpenClaw 连接状态处理')
    .waitFor({ timeout: 5000 });

  assert.equal(previewPayload?.ruleRef, 'manual:linked-preview-rule');
  assert.equal(previewPayload?.requiresApproval, true);
  assert.equal(previewPayload?.message?.groupName, 'Launch Room');
  assert.match(
    previewPayload?.message?.content || '',
    /Create a follow-up task when launch blockers appear/,
  );

  assertNoPageErrors();
  await context.close();
  await fs.rm(launched.userDataDir, { recursive: true, force: true });
  launched = null;
  console.log('linked action preview receipt e2e passed');
} catch (error) {
  if (launched) {
    await launched.context.close().catch(() => {});
    await fs.rm(launched.userDataDir, { recursive: true, force: true }).catch(
      () => {},
    );
  }
  throw error;
}
