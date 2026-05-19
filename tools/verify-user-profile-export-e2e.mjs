import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');
const memoryBaseUrl = 'http://127.0.0.1:39220/api/v1';

const profileItems = Array.from({ length: 1250 }, (_, index) => ({
  id: `profile-export-${index + 1}`,
  itemType: 'interest',
  itemKey: 'focus_project',
  itemValue: `Export Project ${index + 1}`,
  evidenceRefs: [{
    sourceType: 'unit',
    id: `e-${index + 1}`,
    sourceTitle: `Evidence ${index + 1}`,
    sourceUrl: `https://example.test/evidence/${index + 1}`,
    snippet: `Profile evidence snippet ${index + 1}`,
  }],
  sourceKind: index % 2 === 0 ? 'explicit' : 'inferred',
  confidence: 0.8,
  userConfirmed: index % 2 === 0,
  status: index % 2 === 0 ? 'active' : 'pending_confirm',
  salienceScore: 0.8,
  mentionCount: 1,
  lastSeen: Math.floor(Date.now() / 1000) - index,
}));

const profileItemRequests = [];
const profileMutations = [];
let phase = 'initial-load';
let server;

function sendJson(res, body) {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-user-id,authorization',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function startMemoryFixtureServer() {
  server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type,x-user-id,authorization',
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', memoryBaseUrl);
    if (url.pathname === '/api/v1/profile/items' && req.method === 'GET') {
      const limit = Number(url.searchParams.get('limit') || '50');
      const offset = Number(url.searchParams.get('offset') || '0');
      const visibleProfileItems = profileItems.filter((item) =>
        item.status === 'active' || item.status === 'pending_confirm'
      );
      profileItemRequests.push({ phase, limit, offset });
      sendJson(res, {
        items: visibleProfileItems.slice(offset, offset + limit),
        total: visibleProfileItems.length,
        limit,
        offset,
      });
      return;
    }

    if (url.pathname === '/api/v1/profile/items' && req.method === 'POST') {
      const body = await readJsonBody(req);
      profileMutations.push({ type: 'create', body });
      const created = {
        id: `created-profile-${profileMutations.length}`,
        itemType: body.itemType,
        itemKey: body.itemKey,
        itemValue: body.itemValue,
        evidenceRefs: body.evidenceRefs || [],
        sourceKind: 'explicit',
        confidence: body.confidence ?? 1,
        userConfirmed: true,
        status: 'active',
        salienceScore: body.confidence ?? 1,
        mentionCount: 1,
        lastSeen: Math.floor(Date.now() / 1000),
      };
      profileItems.unshift(created);
      sendJson(res, created);
      return;
    }

    const deleteMatch = url.pathname.match(/^\/api\/v1\/profile\/items\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(deleteMatch[1]);
      const item = profileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      item.status = 'retracted';
      profileMutations.push({ type: 'delete', id });
      sendJson(res, { id, deleted: true });
      return;
    }

    const restoreMatch = url.pathname.match(/^\/api\/v1\/profile\/items\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === 'POST') {
      const id = decodeURIComponent(restoreMatch[1]);
      const item = profileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      item.status = item.userConfirmed ? 'active' : 'pending_confirm';
      profileMutations.push({ type: 'restore', id, status: item.status });
      sendJson(res, item);
      return;
    }

    if (url.pathname === '/api/v1/profile/core') {
      sendJson(res, { content: '# USER_CORE\n' });
      return;
    }

    if (url.pathname === '/api/v1/profile/opinions') {
      sendJson(res, { items: [], total: 0, limit: 50, offset: 0 });
      return;
    }

    if (url.pathname === '/api/v1/health') {
      sendJson(res, {
        status: 'ok',
        database: {
          connected: true,
          messageCount: 12,
          entityCount: 3,
          chunkCount: 4,
        },
      });
      return;
    }

    if (url.pathname === '/api/v1/stats') {
      sendJson(res, {
        messages: { total: 12, today: 2, thisWeek: 6 },
        entities: { total: 3, byType: { Project: 3 } },
        relationships: { total: 1 },
      });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Unhandled fixture path: ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(39220, '127.0.0.1', resolve);
  });
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'user-profile-export-e2e-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
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

let launched;

try {
  await startMemoryFixtureServer();
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;

  const envConfig = {
    MEMORY_SERVICE_BASE_URL: memoryBaseUrl,
    MEMORY_SERVICE_TIMEOUT: 5000,
    LLM_TYPE: 'local',
  };

  await serviceWorker.evaluate(async ({ config }) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      envConfig: config,
      userinfo: {
        fullName: 'Profile E2E',
        userEmail: 'profile-e2e@example.test',
        username: 'profile.e2e',
      },
    });
  }, { config: envConfig });

  const configPage = await context.newPage();
  await configPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  const configResponse = await configPage.evaluate(async (config) => {
    return await chrome.runtime.sendMessage({
      type: 'UPDATE_ENV_CONFIG',
      config,
    });
  }, envConfig);
  await configPage.close();
  assert.equal(configResponse?.success, true);

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html#/user-profile`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.getByText('用户画像分析').waitFor({ timeout: 15000 });
  await page.locator('.review-label', { hasText: '待确认推断' }).waitFor({
    timeout: 15000,
  });
  assert.ok(
    profileItemRequests.length > 0,
    'user profile page should request profile items from the memory service',
  );
  await page.locator('.items-count').waitFor({ state: 'attached', timeout: 15000 });
  assert.equal((await page.locator('.items-count').textContent())?.trim(), '1000/1250 条');
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 50);

  const firstProfileRow = page.locator('.profile-item-row').first();
  await firstProfileRow.locator('button.evidence-toggle-btn').click();
  await firstProfileRow.locator('.profile-evidence-panel', {
    hasText: 'Profile evidence snippet 1',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-item', {
    hasText: 'unit',
  }).waitFor({ timeout: 10000 });

  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 999');
  await page.locator('.profile-items-summary', {
    hasText: '显示 1/1 条匹配结果（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 1);
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  }).waitFor({ timeout: 10000 });

  await page.locator('button.tertiary-action-btn').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });

  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Profile evidence snippet 999');
  await page.locator('.profile-items-summary', {
    hasText: '显示 1/1 条匹配结果（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  }).waitFor({ timeout: 10000 });

  await page.locator('button.tertiary-action-btn').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });

  phase = 'load-all';
  await page.locator('button.load-all-items-btn').click();
  await page.locator('.status-message.success', {
    hasText: '已加载全部画像条目',
  }).waitFor({ timeout: 10000 });
  assert.equal((await page.locator('.items-count').textContent())?.trim(), '1250 条');
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1250 条（共 1250 条）',
  }).waitFor({ timeout: 10000 });

  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 1200');
  await page.locator('.profile-items-summary', {
    hasText: '显示 1/1 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 1200',
  }).waitFor({ timeout: 10000 });

  await page.locator('button.tertiary-action-btn').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1250 条（共 1250 条）',
  }).waitFor({ timeout: 10000 });

  await page.locator('.profile-filter-control select').first().selectOption('usable');
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/625 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 50);

  await page.locator('.load-more-row button').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 100/625 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 100);

  phase = 'export';
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button.export-btn').click(),
  ]);
  const exportPath = await download.path();
  assert.ok(exportPath, 'export download should resolve to a local path');
  const exportJson = JSON.parse(await fs.readFile(exportPath, 'utf8'));

  assert.equal(exportJson.userProfile.items.length, profileItems.length);
  assert.equal(exportJson.userProfile.totalItems, profileItems.length);
  assert.equal(
    exportJson.exportInfo.pagination.exportedProfileItems,
    profileItems.length,
  );
  assert.equal(exportJson.exportInfo.pagination.totalProfileItems, profileItems.length);
  assert.equal(exportJson.exportInfo.pagination.truncated, false);
  assert.equal(exportJson.exportSummary.profileCompleteness, '完整');
  assert.equal(exportJson.exportSummary.exportedProfileItems, profileItems.length);

  const initialRequests = profileItemRequests.filter(
    (request) => request.phase === 'initial-load',
  );
  const exportRequests = profileItemRequests.filter(
    (request) => request.phase === 'export',
  );
  const loadAllRequests = profileItemRequests.filter(
    (request) => request.phase === 'load-all',
  );

  assert.equal(initialRequests.length, 5, 'profile page should keep the 1000-item view cap');
  assert.equal(loadAllRequests.length, 7, 'load all should fetch every profile page');
  assert.equal(exportRequests.length, 7, 'profile export should fetch every page');
  assert.deepEqual(loadAllRequests.at(-1), {
    phase: 'load-all',
    limit: 200,
    offset: 1200,
  });
  assert.deepEqual(exportRequests.at(-1), {
    phase: 'export',
    limit: 200,
    offset: 1200,
  });

  await page.locator('.status-message.success', {
    hasText: '画像已导出',
  }).waitFor({ timeout: 10000 });

  await page.locator('.owner-profile-form select').nth(1).selectOption('__custom__');
  await page.locator('.custom-profile-key-input').fill('project.personal_ai.priority');
  await page.locator('.owner-profile-form textarea').fill(
    'Personal AI profile calibration should surface reversible changes.',
  );
  await page.locator('.owner-profile-form button.primary-action-btn').click();
  await page.locator('.status-message.success', {
    hasText: '主人表达画像已添加',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'create',
    body: {
      itemType: 'preference',
      itemKey: 'project.personal_ai.priority',
      itemValue: 'Personal AI profile calibration should surface reversible changes.',
      confidence: 1,
      evidenceRefs: [{
        sourceType: 'manual',
        source: 'user_profile_page',
        capturedAt: profileMutations.at(-1).body.evidenceRefs[0].capturedAt,
      }],
    },
  });

  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 999');
  const undoTargetRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  });
  await undoTargetRow.waitFor({ timeout: 10000 });
  await undoTargetRow.locator('button.danger-action-btn').click();
  await page.locator('.status-message.success', {
    hasText: '已排除“Export Project 999”',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'delete',
    id: 'profile-export-999',
  });

  await page.locator('.status-action-btn', { hasText: '撤销排除' }).click();
  await page.locator('.status-message.success', {
    hasText: '已恢复“Export Project 999”',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'restore',
    id: 'profile-export-999',
    status: 'active',
  });
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  }).waitFor({ timeout: 10000 });

  assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join('; ')}`);

  console.log('verify-user-profile-export-e2e: ok');
} finally {
  if (launched) {
    await launched.context.close();
    await fs.rm(launched.userDataDir, { recursive: true, force: true });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}
