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

function jsonResponse(body) {
  return {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function buildOllamaResponse(prompt) {
  if (prompt.includes('<message_group')) {
    return {
      data: [
        {
          shouldNotify: true,
          shouldStore: true,
          matched_rule: '[RULE_REF:manual:manual-1]',
          matched_rule_refs: ['manual:manual-1'],
          matched_rule_ids: [],
          summary: 'manual blocker watch rule matched',
          confidence: 0.88,
        },
      ],
    };
  }

  if (prompt.includes('实体') || prompt.includes('提取')) {
    return {
      entities: {
        people: [{ name: 'Morgan Chen' }, { name: 'Avery Wong' }],
        projects: [{ name: 'API split' }],
        topics: ['blocker'],
        resources: [],
        webpages: [],
        jiraTickets: [],
        conversations: [],
      },
      metadata: {
        sentiment: 'neutral',
        priority: 'medium',
        category: [],
        tags: ['agent-workflow-e2e'],
      },
      actions: [],
    };
  }

  if (prompt.includes('分析以下人物之间可能的关系')) {
    return {
      relationships: [
        {
          source: 'Morgan Chen',
          target: 'Avery Wong',
          relationship: 'Escalation collaborators',
          confidence: 0.8,
        },
      ],
    };
  }

  if (prompt.includes('分析以下消息的重要性')) {
    return {
      isImportant: true,
      shouldStore: true,
      priority: 'high',
      reason: 'blocker message should be stored',
      tags: ['blocker'],
    };
  }

  if (prompt.includes('分析以下消息并提供回复建议')) {
    return {
      needsReply: false,
      replyText: '',
      priority: 'low',
      reason: 'no reply needed',
    };
  }

  return {};
}

async function installNetworkMocks(context) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes('/api/v1/recall')) {
      await route.fulfill(
        jsonResponse({
          items: [],
          totalFound: 0,
          queryTimeMs: 1,
          channels: [],
        }),
      );
      return;
    }

    if (url.includes('/api/v1/entities')) {
      await route.fulfill(
        jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }),
      );
      return;
    }

    if (url.includes('/api/v1/outreach/templates/runtime-status')) {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
      return;
    }

    if (url.endsWith('/api/generate')) {
      const body = JSON.parse(request.postData() || '{}');
      await route.fulfill(
        jsonResponse({
          response: JSON.stringify(buildOllamaResponse(String(body.prompt || ''))),
        }),
      );
      return;
    }

    await route.continue();
  });
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

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'agent-workflow-options-browser-'),
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

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  await installNetworkMocks(context);

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        ANALYSIS_TYPE: 'agentWorkflow',
        LLM_TYPE: 'local',
        OLLAMA_BASE_URL: 'http://mock-ollama',
        OLLAMA_MODEL: 'mock-model',
        OLLAMA_QUERY_MODEL: 'mock-model',
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
      },
      userinfo: {
        fullName: 'Current User',
        username: 'current.user',
      },
      concernedItems: [
        {
          id: 'manual-1',
          text: 'Only notify me when blocker is mentioned',
          expiredAt: 0,
          notifyMethod: 'bot',
        },
      ],
    });
  });

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h2', { hasText: '标准Agent系统设置' }).waitFor({
    timeout: 15000,
  });
  await page.locator('h3', { hasText: '关注项测试' }).waitFor({
    timeout: 15000,
  });

  await page
    .locator('.agent-workflow-scenario-actions button', { hasText: '运行样例' })
    .click();
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^关注项匹配$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^存储决策$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^通知决策$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^执行链路$/ })
    .waitFor({ timeout: 15000 });

  const decisionPathText = await page.locator('.agent-workflow-path').innerText();
  assert.match(decisionPathText, /manual:manual-1/);
  assert.match(decisionPathText, /置信度 88%/);
  assert.match(decisionPathText, /6 个 Agent \/ 8 个工具/);
  assertNoPageErrors();

  console.log('verify-agent-workflow-options-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
