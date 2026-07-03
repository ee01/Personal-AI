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

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'auto-reply-readiness-e2e-'),
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
      `Auto reply readiness page errors: ${errors.join('; ')}`,
    );
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: 'http://127.0.0.1:49211/api/v1',
        OPENCLAW_ENABLED: false,
      },
      userinfo: {
        username: 'auto.reply.verify',
        fullName: 'Auto Reply Verify',
      },
      taskSchedulerStates: {
        message_analysis: { enabled: true },
      },
      concernedItems: [
        {
          id: 'fixed-reply-ready',
          text: 'Fixed reply ready rule',
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
          id: 'fixed-reply-empty',
          text: 'Fixed reply empty rule',
          expiredAt: 0,
          filterGroup: 'Support Handoff',
          autoReply: true,
          autoReplyConfig: {
            enabled: true,
            replyContent: '   ',
            useAIGenerate: false,
            reviewMode: 'delayed',
            delayHours: 2,
          },
        },
      ],
    });
  });

  await context.route('**/api/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    });
  });

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/topic-modal.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.locator('h2', { hasText: '记忆入口规则' }).waitFor({
    timeout: 10000,
  });

  const readyCard = page.locator('.topic-item', {
    hasText: 'Fixed reply ready rule',
  });
  await readyCard.locator('.topic-summary-row').click({ timeout: 5000 });
  await readyCard
    .locator('.supporting-panel', {
      hasText: '自动答复草稿',
    })
    .waitFor({ timeout: 5000 });
  await readyCard
    .locator('.supporting-panel', {
      hasText: '固定回复就绪',
    })
    .waitFor({ timeout: 5000 });
  await readyCard
    .locator('.supporting-panel', {
      hasText: 'I will take a look and follow up.',
    })
    .waitFor({ timeout: 5000 });

  const emptyCard = page.locator('.topic-item', {
    hasText: 'Fixed reply empty rule',
  });
  await emptyCard.locator('.topic-summary-row').click({ timeout: 5000 });
  await emptyCard
    .locator('.supporting-panel', {
      hasText: '自动答复未就绪',
    })
    .waitFor({ timeout: 5000 });
  await emptyCard
    .locator('.supporting-panel', {
      hasText: '固定回复未就绪',
    })
    .waitFor({ timeout: 5000 });
  await emptyCard
    .locator('.supporting-panel', {
      hasText: '命中时只会跳过自动答复入队',
    })
    .waitFor({ timeout: 5000 });

  await emptyCard.getByRole('button', { name: /编辑/ }).click();
  const editReadiness = page.locator(
    '.topic-edit-form .auto-reply-content-readiness',
  );
  await editReadiness
    .locator('text=固定回复未就绪')
    .waitFor({ timeout: 5000 });
  await editReadiness
    .locator('text=保存后其他规则动作仍生效，但自动答复命中会跳过')
    .waitFor({ timeout: 5000 });
  await editReadiness
    .locator('text=补充固定回复，或开启“每次 AI 生成类似答复”。')
    .waitFor({ timeout: 5000 });
  await page
    .locator('.topic-edit-form .form-buttons button', { hasText: '取消' })
    .click({ timeout: 5000 });

  await page.locator('button', { hasText: '添加规则' }).click({
    timeout: 5000,
  });
  await page.locator('.add-topic-form .rule-prompt-input').fill(
    'New auto reply readiness rule',
  );
  await page.locator('#new-auto-reply').check({ timeout: 5000 });
  const newReadiness = page.locator(
    '.add-topic-form .auto-reply-content-readiness',
  );
  await newReadiness
    .locator('text=AI 生成就绪 · 无固定 fallback')
    .waitFor({ timeout: 5000 });
  await newReadiness
    .locator('text=如果生成失败或为空，本次会跳过入队')
    .waitFor({ timeout: 5000 });
  await page.locator('#new-use-ai').uncheck({ timeout: 5000 });
  await newReadiness
    .locator('text=固定回复未就绪')
    .waitFor({ timeout: 5000 });
  await page.locator('.add-topic-form .reply-content-input').fill(
    'Thanks, I will review it.',
  );
  await newReadiness
    .locator('text=固定回复就绪')
    .waitFor({ timeout: 5000 });
  await newReadiness
    .locator('text=后续命中会复用当前固定文本入队')
    .waitFor({ timeout: 5000 });

  assertNoPageErrors();
  console.log('verify-auto-reply-readiness-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
