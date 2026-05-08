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
    path.join(os.tmpdir(), 'agent-thinking-options-browser-'),
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
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Options page errors: ${errors.join('; ')}`);
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        ANALYSIS_TYPE: 'agentThinking',
        LLM_TYPE: 'local',
        OLLAMA_BASE_URL: 'http://mock-ollama',
        OLLAMA_MODEL: 'mock-model',
        OLLAMA_QUERY_MODEL: 'mock-model',
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
      },
    });
  });

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h2', { hasText: '智能Agent系统设置' }).waitFor({
    timeout: 15000,
  });

  await page.locator('.tools-table td', { hasText: /^historySearch$/ }).waitFor({
    timeout: 15000,
  });
  await page.locator('.tools-table td', { hasText: /^jiraQuery$/ }).waitFor({
    timeout: 15000,
  });

  await page.locator('button', { hasText: '启动演示' }).click();

  await page.locator('.node-result.skipped', { hasText: '跳过' }).waitFor({
    timeout: 12000,
  });
  await page.locator('.flow-node.tool.blocked .node-result.blocked', {
    hasText: '已阻断',
  }).waitFor({ timeout: 12000 });

  const blockedHeader = page
    .locator('.thought-step', { hasText: 'orgStructure' })
    .locator('.step-header')
    .first();
  await blockedHeader.waitFor({ timeout: 12000 });
  await blockedHeader.focus();
  await page.keyboard.press('Enter');
  await assert
    .doesNotReject(async () =>
      page.locator('.thought-step.expanded', { hasText: 'orgStructure' }).waitFor({
        timeout: 3000,
      }),
    );
  assert.equal(await blockedHeader.getAttribute('aria-expanded'), 'true');
  await page.locator('.thought-step.expanded .tool-result', {
    hasText: '工具结果',
  }).waitFor({ timeout: 3000 });

  await page.locator('.agent-result-summary', { hasText: '处理结果' }).waitFor({
    timeout: 12000,
  });
  await assertNoPageErrors();

  console.log('verify-agent-thinking-options-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
