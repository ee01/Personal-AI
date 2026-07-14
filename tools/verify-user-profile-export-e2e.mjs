import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  confidence: index === 0 ? 0.7 : 0.8,
  userConfirmed: index % 2 === 0,
  status: index % 2 === 0 ? 'active' : 'pending_confirm',
  salienceScore: index === 0 ? 0.7 : 0.8,
  mentionCount: index === 0 ? 10 : 1,
  lastSeen: Math.floor(Date.now() / 1000) - index,
}));
profileItems[1].itemValue = 'Zzz Boost Pending Project';

for (const item of profileItems) {
  item.evidenceRefs.push({
    sourceType: 'web',
    sourceTitle: 'Unsafe profile evidence',
    sourceUrl: 'javascript:alert(1)',
  });
}

const retractedProfileItems = [
  {
    id: 'profile-retracted-1',
    itemType: 'interest',
    itemKey: 'focus_project',
    itemValue: 'Archived Project Alpha',
    evidenceRefs: [{
      sourceType: 'unit',
      id: 'retracted-e-1',
      sourceTitle: 'Retracted evidence',
      sourceUrl: 'https://example.test/retracted/1',
      snippet: 'This project was excluded by mistake.',
    }],
    sourceKind: 'explicit',
    confidence: 0.7,
    userConfirmed: true,
    status: 'retracted',
    salienceScore: 0.7,
    mentionCount: 2,
    lastSeen: Math.floor(Date.now() / 1000) - 10,
  },
];

const allProfileItems = [...profileItems, ...retractedProfileItems];

const profileItemRequests = [];
const profileMutations = [];
let phase = 'initial-load';
let server;

function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((normalized, key) => {
      normalized[key] = normalizeJsonValue(value[key]);
      return normalized;
    }, {});
  }
  return value ?? null;
}

function stableJsonStringify(value) {
  return JSON.stringify(normalizeJsonValue(value));
}

function sha256Hex(value) {
  const payload = typeof value === 'string' ? value : stableJsonStringify(value);
  return createHash('sha256').update(payload).digest('hex');
}

async function assertAttributeMatches(locator, attribute, pattern, message) {
  const value = await locator.getAttribute(attribute);
  assert.match(value || '', pattern, message);
}

function sendJson(res, body) {
  res.writeHead(200, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-user-id,authorization',
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-user-id,authorization',
  });
  res.end(JSON.stringify(body));
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const statusFilter = url.searchParams.get('status');
      const requestRecord = { phase, limit, offset, status: statusFilter || undefined };
      if (phase === 'export-failure') {
        profileItemRequests.push(requestRecord);
        sendError(res, 503, { error: 'fixture profile export unavailable' });
        return;
      }
      if (phase === 'retracted-list-failure' && statusFilter === 'retracted') {
        profileItemRequests.push(requestRecord);
        sendError(res, 503, { error: 'fixture retracted profile unavailable' });
        return;
      }
      if (phase === 'load-all-failure' && !statusFilter) {
        profileItemRequests.push(requestRecord);
        await delay(400);
        sendError(res, 503, { error: 'fixture load-all profile unavailable' });
        return;
      }
      if (phase === 'load-all' && offset === 0) {
        await delay(400);
      }
      if (phase === 'export' && offset === 0) {
        await delay(400);
      }
      if (phase === 'retracted-list' && statusFilter === 'retracted' && offset === 0) {
        await delay(400);
      }
      const visibleProfileItems = statusFilter === 'all'
        ? allProfileItems
        : statusFilter
        ? allProfileItems.filter((item) => item.status === statusFilter)
        : allProfileItems.filter((item) =>
          item.status === 'active' || item.status === 'pending_confirm'
        );
      profileItemRequests.push(requestRecord);
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
      if (phase === 'create-pending-receipt') {
        await delay(400);
      }
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
      allProfileItems.unshift(created);
      sendJson(res, created);
      return;
    }

    const profileItemMatch = url.pathname.match(/^\/api\/v1\/profile\/items\/([^/]+)$/);
    if (profileItemMatch && req.method === 'PUT') {
      const id = decodeURIComponent(profileItemMatch[1]);
      const item = allProfileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      const body = await readJsonBody(req);
      if (
        (phase === 'overview-star-confirm' && id === 'profile-export-2') ||
        (phase === 'calibration-pending-success' && id === 'profile-export-999') ||
        (phase === 'influence-undo' && id === 'profile-export-999') ||
        (phase === 'influence-update-failure' && id === 'profile-export-997')
      ) {
        await delay(400);
      }
      if (phase === 'influence-update-failure' && id === 'profile-export-997') {
        profileMutations.push({ type: 'update-failed', id, body });
        sendError(res, 503, { error: 'fixture profile update unavailable' });
        return;
      }
      Object.assign(item, {
        confidence: body.confidence ?? item.confidence,
        salienceScore: body.salienceScore ?? item.salienceScore,
        status: body.status ?? item.status,
      });
      profileMutations.push({ type: 'update', id, body });
      sendJson(res, item);
      return;
    }

    if (profileItemMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(profileItemMatch[1]);
      const item = allProfileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      if (phase === 'retract-pending-receipt' && id === 'profile-export-999') {
        await delay(400);
      }
      item.status = 'retracted';
      profileMutations.push({ type: 'delete', id });
      sendJson(res, { id, deleted: true });
      return;
    }

    const confirmMatch = url.pathname.match(/^\/api\/v1\/profile\/items\/([^/]+)\/confirm$/);
    if (confirmMatch && req.method === 'POST') {
      const id = decodeURIComponent(confirmMatch[1]);
      const item = allProfileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      if (phase === 'confirm-pending-receipt' && id === 'profile-export-990') {
        await delay(400);
      }
      if (phase === 'boost-confirm-failure' && id === 'profile-export-996') {
        profileMutations.push({ type: 'confirm-failed', id });
        sendError(res, 503, { error: 'fixture confirmation unavailable' });
        return;
      }
      item.userConfirmed = true;
      item.status = 'active';
      profileMutations.push({ type: 'confirm', id });
      sendJson(res, item);
      return;
    }

    const restoreMatch = url.pathname.match(/^\/api\/v1\/profile\/items\/([^/]+)\/restore$/);
    if (restoreMatch && req.method === 'POST') {
      const id = decodeURIComponent(restoreMatch[1]);
      const item = allProfileItems.find((candidate) => candidate.id === id);
      if (!item) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Profile item not found' }));
        return;
      }
      if (phase === 'restore-pending-receipt' && id === 'profile-export-999') {
        await delay(400);
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
      if (phase === 'export-partial-diagnostics') {
        sendError(res, 503, { error: 'fixture health unavailable' });
        return;
      }
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
      if (phase === 'export-partial-diagnostics') {
        sendError(res, 503, { error: 'fixture stats unavailable' });
        return;
      }
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
  await page.locator('.profile-items-scope-receipt', {
    hasText: '当前搜索/筛选只匹配已加载 1000/1250 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-scope-receipt', {
    hasText: '先点“加载全部”再做全库判断',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-scope-receipt', {
    hasText: '本区只读，不确认、排除或写入画像',
  }).waitFor({ timeout: 10000 });
  const exportButton = page.locator('button.export-btn');
  const profileSearchInput = page.getByPlaceholder('名称、键、来源、状态或证据');
  const statusFilterSelect = page.locator('.profile-filter-control select').first();
  const sortSelect = page.locator('.profile-filter-control select').nth(1);
  const clearFiltersButton = page.locator('button.tertiary-action-btn');
  const loadAllButton = page.locator('button.load-all-items-btn');
  const retractedToggleButton = page.locator('button.retracted-items-toggle-btn');
  const explicitProfileSubmitButton = page.locator('.owner-profile-form button.primary-action-btn');

  await assertAttributeMatches(
    exportButton,
    'aria-label',
    /导出画像会重新分页请求全部状态与已排除审计/,
    'export button should expose full-status export boundary',
  );
  await assertAttributeMatches(
    exportButton,
    'title',
    /不限 当前页 1000\/1250 条/,
    'export button hover should distinguish visible slice from export scope',
  );
  await assertAttributeMatches(
    profileSearchInput,
    'aria-label',
    /当前列表只加载 1000\/1250 条画像/,
    'profile search input should expose loaded-slice scope',
  );
  await assertAttributeMatches(
    profileSearchInput,
    'title',
    /加载全部前不能证明全库不存在更多匹配/,
    'profile search hover should warn against whole-store inference before load-all',
  );
  await assertAttributeMatches(
    statusFilterSelect,
    'aria-label',
    /状态筛选只改变本地列表显示/,
    'status filter should expose local-only display boundary',
  );
  await assertAttributeMatches(
    sortSelect,
    'aria-label',
    /排序只重排本地已加载画像/,
    'sort control should expose local ordering boundary',
  );
  await assertAttributeMatches(
    clearFiltersButton,
    'aria-label',
    /当前没有搜索、状态筛选或排序可清除/,
    'clear filters button should explain disabled no-op state',
  );
  await assertAttributeMatches(
    loadAllButton,
    'aria-label',
    /只读请求 Memory Service 加载全部当前画像条目/,
    'load-all button should expose read-only pagination boundary',
  );
  await assertAttributeMatches(
    retractedToggleButton,
    'aria-label',
    /只读加载 status=retracted 已排除画像审计快照/,
    'retracted toggle should expose read-only audit boundary',
  );
  await assertAttributeMatches(
    explicitProfileSubmitButton,
    'aria-label',
    /先填写画像内容/,
    'explicit profile submit should explain disabled missing-content state',
  );
  assert.equal(await page.locator('.profile-item-row').count(), 50);

  const entryMutationCount = profileMutations.length;
  await page.locator('.review-summary-card', {
    hasText: '待确认推断',
  }).getByRole('button', { name: '处理' }).click();
  await page.locator('.profile-review-entry-receipt', {
    hasText: '已定位待确认推断',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '筛选：待确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '当前已加载 1000/1250 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '只导航和调整本地筛选，不确认、降权、排除、写入 USER_CORE、刷新证据、导出或调用外部 provider',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '确认前不使用',
  }).waitFor({ timeout: 10000 });
  await page.locator('.review-filter-btn.active', {
    hasText: '待确认',
  }).waitFor({ timeout: 10000 });
  const predictionLowerButton = page.locator('.prediction-item', {
    hasText: 'Zzz Boost Pending Project',
  }).locator('button.influence-action-btn', { hasText: '降低影响' });
  await assertAttributeMatches(
    predictionLowerButton,
    'aria-label',
    /降低影响 Zzz Boost Pending Project：当前影响力 80%，目标影响力 25%。这是待确认推断队列中的快速校准。只写入新的 confidence\/salience，不会自动确认；确认前不会进入 USER_CORE、召回或 provider context/,
    'prediction lower button should expose no-auto-confirm boundary',
  );
  await assertAttributeMatches(
    predictionLowerButton,
    'title',
    /服务确认前不能证明已写入或进入个性化；不会改旧回答、刷新或删除证据、排除\/恢复画像、外发、跨平台同步、导出或发送内容/,
    'prediction lower hover should expose service-confirmation and non-effect boundary',
  );
  assert.equal(
    profileMutations.length,
    entryMutationCount,
    'review summary entry should not write profile mutations',
  );

  await page.locator('.review-summary-card', {
    hasText: '证据覆盖',
  }).getByRole('button', { name: '核对' }).click();
  await page.locator('.profile-review-entry-receipt', {
    hasText: '已定位缺证据画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '列表筛选：缺证据',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '只读核对',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-summary', {
    hasText: '显示 0/0 条匹配结果（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(
    profileMutations.length,
    entryMutationCount,
    'evidence review entry should not write profile mutations',
  );

  await page.locator('.review-summary-card', {
    hasText: '确认率',
  }).getByRole('button', { name: '查看' }).click();
  await page.locator('.profile-review-entry-receipt', {
    hasText: '已定位画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '列表筛选：全部',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-review-entry-receipt', {
    hasText: '本地导航',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(
    profileMutations.length,
    entryMutationCount,
    'profile item review entry should not write profile mutations',
  );

  const firstProfileRow = page.locator('.profile-item-row').first();
  const firstEvidenceButton = firstProfileRow.locator('button.evidence-toggle-btn');
  assert.match(
    await firstEvidenceButton.getAttribute('aria-label'),
    /只读查看2 条证据；不会确认画像、写入 USER_CORE 或刷新来源/,
  );
  await firstEvidenceButton.click();
  assert.match(
    await firstEvidenceButton.getAttribute('aria-label'),
    /只读收起2 条证据；不会确认画像、写入 USER_CORE 或刷新来源/,
  );
  await firstProfileRow.locator('.profile-evidence-scope-receipt', {
    hasText: '证据审计',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-scope-receipt', {
    hasText: '只读审计：展开只显示本次已加载的来源、URL 或片段摘要',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-scope-receipt', {
    hasText: '不会确认画像、写入 USER_CORE、刷新来源、同步外部平台或发送内容',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-scope-receipt', {
    hasText: '不安全链接只显示隐藏原因',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-panel', {
    hasText: 'Profile evidence snippet 1',
  }).waitFor({ timeout: 10000 });
  await firstProfileRow.locator('.profile-evidence-item', {
    hasText: 'unit',
  }).waitFor({ timeout: 10000 });
  const unsafeEvidenceItem = firstProfileRow.locator('.profile-evidence-item', {
    hasText: 'Unsafe profile evidence',
  });
  await unsafeEvidenceItem.waitFor({ timeout: 10000 });
  assert.equal(
    await unsafeEvidenceItem.getAttribute('href'),
    null,
    'unsafe profile evidence URLs should not be rendered as clickable hrefs',
  );
  await unsafeEvidenceItem.locator('.profile-evidence-warning', {
    hasText: '不支持 javascript 协议',
  }).waitFor({ timeout: 10000 });

  const currentFocusCard = page.locator('.profile-card', {
    hasText: '当前关注重点',
  });
  const projectOneFocusItem = currentFocusCard.locator('.interest-item').filter({
    has: page.locator('.interest-name', { hasText: /^Export Project 1$/ }),
  }).first();
  await projectOneFocusItem.locator('.star-calibration-receipt', {
    hasText: '当前影响力 70%',
  }).waitFor({ timeout: 10000 });
  await projectOneFocusItem.locator('.star-calibration-receipt', {
    hasText: '该条已确认，星级只改影响力',
  }).waitFor({ timeout: 10000 });
  await projectOneFocusItem.locator('.star-calibration-receipt', {
    hasText: '2 条证据保留',
  }).waitFor({ timeout: 10000 });
  await projectOneFocusItem.locator('.star-calibration-receipt', {
    hasText: '只影响后续画像选择',
  }).waitFor({ timeout: 10000 });
  await projectOneFocusItem.locator('.star-calibration-receipt', {
    hasText: 'active + confirmed 才进入个性化',
  }).waitFor({ timeout: 10000 });

  const projectTwoFocusItem = currentFocusCard.locator('.interest-item').filter({
    has: page.locator('.interest-name', { hasText: /^Zzz Boost Pending Project$/ }),
  }).first();
  await projectTwoFocusItem.locator('.star-calibration-receipt', {
    hasText: '未确认条目会同时确认，确认后才可能使用',
  }).waitFor({ timeout: 10000 });

  phase = 'star-raise';
  await projectOneFocusItem.getByLabel('将 Export Project 1 重要性设为 4 星', { exact: true }).click();
  await page.locator('.status-message.success', {
    hasText: '重要性已更新',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-success', {
    hasText: '已提高影响：Export Project 1',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '影响力 80%',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '该条已确认，后续仍只会按场景进入个性化上下文',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-2), {
    type: 'update',
    id: 'profile-export-1',
    body: {
      confidence: 0.8,
      salienceScore: 0.8,
      status: 'active',
    },
  });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'confirm',
    id: 'profile-export-1',
  });

  phase = 'initial-load';
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 1200');
  await page.locator('.profile-items-summary', {
    hasText: '显示 0/0 条匹配结果（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-scope-receipt', {
    hasText: '当前无匹配只代表已加载切片无结果',
  }).waitFor({ timeout: 10000 });
  await page.locator('.inline-empty', {
    hasText: '当前已加载条目中没有匹配结果，可先加载全部画像后再搜索',
  }).waitFor({ timeout: 10000 });

  await assertAttributeMatches(
    clearFiltersButton,
    'aria-label',
    /清除只恢复本地搜索、状态筛选和排序/,
    'clear filters button should expose local reset boundary when filters are active',
  );
  await page.locator('button.tertiary-action-btn').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
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
  await page.locator('.export-scope-receipt', {
    hasText: '页面已加载 1000/1250 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-scope-receipt', {
    hasText: '导出会重新分页拉取全部状态与已排除审计',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: 'JSON + manifest 指纹，可对照下载文件',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: '重新分页拉取全部状态，不限当前 1000/1250 切片',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: '诊断失败只写入 warning，不阻断画像拿回',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: '只下载本地副本，不恢复、删除、同步或发送画像',
  }).waitFor({ timeout: 10000 });

  phase = 'load-all-failure';
  await page.locator('button.load-all-items-btn').click();
  await page.locator('.profile-items-load-receipt.receipt-info', {
    hasText: '正在加载全部画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '当前切片 1000/1250 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '只读重新分页',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '不会确认、排除、恢复、写入 USER_CORE、刷新证据、导出或调用外部 provider',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.error', {
    hasText: 'fixture load-all profile unavailable',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt.receipt-warning', {
    hasText: '加载全部画像未完成',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '保留旧切片 1000/1250 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '不能证明全库没有更多画像或匹配结果',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '不证明全库',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1000 条（已加载 1000/1250 条）',
  }).waitFor({ timeout: 10000 });

  phase = 'load-all';
  await page.locator('button.load-all-items-btn').click();
  await page.locator('.profile-items-load-receipt.receipt-info', {
    hasText: '正在加载全部画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '已加载全部画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt.receipt-success', {
    hasText: '已加载全部画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '当前搜索和筛选覆盖这次已拉取的完整条目集',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '加载全部只扩大本页审计范围',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: 'active + confirmed 才个性化',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-load-receipt', {
    hasText: '快照 1250/1250 条',
  }).waitFor({ timeout: 10000 });
  assert.equal((await page.locator('.items-count').textContent())?.trim(), '1250 条');
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1250 条（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  await assertAttributeMatches(
    profileSearchInput,
    'aria-label',
    /当前列表已加载全部 1250 条画像/,
    'profile search input should update boundary after load-all succeeds',
  );

  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 1200');
  await page.locator('.profile-items-summary', {
    hasText: '显示 1/1 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-scope-receipt', {
    hasText: '当前搜索/筛选已覆盖本页全部 1250 条画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-items-scope-receipt', {
    hasText: '它只改变列表显示，不限制导出，也不会确认、排除或写入画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 1200',
  }).waitFor({ timeout: 10000 });

  await assertAttributeMatches(
    clearFiltersButton,
    'aria-label',
    /当前列表已加载全部 1250 条画像/,
    'clear filters boundary should update to full-list scope after load-all',
  );
  await page.locator('button.tertiary-action-btn').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/1250 条（共 1250 条）',
  }).waitFor({ timeout: 10000 });

  await page.locator('.profile-filter-control select').first().selectOption('usable');
  await page.locator('.profile-items-summary', {
    hasText: '显示 50/625 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  await assertAttributeMatches(
    statusFilterSelect,
    'aria-label',
    /当前列表已加载全部 1250 条画像/,
    'status filter should update boundary after load-all succeeds',
  );
  await assertAttributeMatches(
    sortSelect,
    'aria-label',
    /不会改变 confidence、salience、确认状态、证据或导出范围/,
    'sort control should explain it does not rewrite ranking fields',
  );
  await page.locator('.profile-items-scope-receipt', {
    hasText: '当前搜索/筛选已覆盖本页全部 1250 条画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-scope-receipt', {
    hasText: '当前搜索/筛选不会限制导出',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-scope-receipt', {
    hasText: '导出包含全部画像状态与已排除审计',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: '当前搜索/筛选不限制导出',
  }).waitFor({ timeout: 10000 });
  await page.locator('.export-preflight-checklist', {
    hasText: '包含 active/pending/retracted/archived/superseded 全部状态',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 50);

  await assertAttributeMatches(
    page.locator('.load-more-row button'),
    'aria-label',
    /显示当前筛选下后续 575 条已加载画像/,
    'load-more button should expose local-visible-list boundary',
  );
  await page.locator('.load-more-row button').click();
  await page.locator('.profile-items-summary', {
    hasText: '显示 100/625 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.profile-item-row').count(), 100);

  phase = 'export';
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('button.export-btn').click();
  await page.locator('.status-message.info', {
    hasText: '正在准备画像导出',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt.receipt-info', {
    hasText: '正在准备画像导出',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '下载尚未开始',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '请求 status=all',
  }).waitFor({ timeout: 10000 });
  await assertAttributeMatches(
    exportButton,
    'aria-label',
    /同一轮画像导出进行中/,
    'export button should expose in-flight singleflight boundary',
  );
  await assertAttributeMatches(
    exportButton,
    'title',
    /重复点击不会启动第二次分页/,
    'export button hover should explain duplicate export clicks are ignored',
  );
  await page.locator('.profile-export-receipt', {
    hasText: '重复点击不会启动第二次 status=all 分页',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '生成第二个 manifest 或请求第二次下载',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '单飞中：忽略重复点击',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '不会恢复、删除、同步或发送画像',
  }).waitFor({ timeout: 10000 });
  const download = await downloadPromise;
  const exportPath = await download.path();
  assert.ok(exportPath, 'export download should resolve to a local path');
  const exportJson = JSON.parse(await fs.readFile(exportPath, 'utf8'));

  assert.equal(exportJson.userProfile.items.length, allProfileItems.length);
  assert.equal(exportJson.userProfile.currentItems.length, profileItems.length);
  assert.equal(exportJson.userProfile.inactiveAuditItems.length, retractedProfileItems.length);
  assert.equal(exportJson.userProfile.totalItems, allProfileItems.length);
  assert.equal(exportJson.userProfile.currentTotalItems, profileItems.length);
  assert.equal(
    exportJson.exportInfo.pagination.exportedProfileItems,
    allProfileItems.length,
  );
  assert.equal(exportJson.exportInfo.pagination.totalProfileItems, allProfileItems.length);
  assert.equal(exportJson.exportInfo.pagination.truncated, false);
  assert.equal(exportJson.exportInfo.pagination.statusScope, 'all');
  assert.deepEqual(exportJson.exportInfo.warnings, []);
  assert.equal(exportJson.exportInfo.optionalSections.systemHealth.available, true);
  assert.equal(exportJson.exportInfo.optionalSections.entityStatistics.available, true);
  assert.equal(exportJson.exportInfo.version, '2.2');
  assert.equal(exportJson.exportInfo.manifest.manifestVersion, '1.0');
  assert.match(exportJson.exportInfo.manifest.manifestId, /^profile-export-/);
  assert.equal(exportJson.exportInfo.manifest.formatVersion, '2.2');
  assert.deepEqual(
    exportJson.exportInfo.manifest.pagination,
    exportJson.exportInfo.pagination,
  );
  assert.equal(exportJson.exportInfo.manifest.scope.statusScope, 'all');
  assert.equal(exportJson.exportInfo.manifest.scope.includesCurrentItems, true);
  assert.equal(exportJson.exportInfo.manifest.scope.includesInactiveAuditItems, true);
  assert.equal(exportJson.exportInfo.manifest.scope.diagnosticWarnings, 0);
  assert.equal(exportJson.exportInfo.manifest.portabilityBoundary.localJsonOnly, true);
  assert.equal(exportJson.exportInfo.manifest.portabilityBoundary.restoreRequiresSeparateFlow, true);
  assert.equal(exportJson.exportInfo.manifest.portabilityBoundary.externalSyncAuthorized, false);
  assert.equal(exportJson.exportInfo.manifest.integrity.algorithm, 'SHA-256');
  assert.equal(exportJson.exportInfo.manifest.integrity.fingerprintAvailable, true);
  assert.equal(
    exportJson.exportInfo.manifest.integrity.profileItemsSha256,
    sha256Hex(exportJson.userProfile.items),
  );
  assert.equal(
    exportJson.exportInfo.manifest.integrity.userCoreSha256,
    sha256Hex(exportJson.userProfile.core),
  );
  assert.equal(
    exportJson.exportInfo.manifest.integrity.profileAuditSha256,
    sha256Hex(exportJson.exportInfo.profileAudit),
  );
  assert.equal(exportJson.exportInfo.profileAudit.confirmedItems, 626);
  assert.equal(exportJson.exportInfo.profileAudit.pendingConfirmationItems, 625);
  assert.equal(exportJson.exportInfo.profileAudit.usableProfileItems, 625);
  assert.equal(exportJson.exportInfo.profileAudit.heldForConfirmationItems, 626);
  assert.equal(exportJson.exportInfo.profileAudit.retractedItems, 1);
  assert.equal(exportJson.exportInfo.profileAudit.inactiveAuditItems, 1);
  assert.equal(exportJson.exportInfo.profileAudit.withoutEvidenceItems, 0);
  assert.equal(
    exportJson.exportInfo.profileAudit.personalizationBoundary.rule,
    'Only active profile items with userConfirmed=true are eligible for personalization and provider context.',
  );
  assert.equal(exportJson.exportSummary.profileCompleteness, '完整');
  assert.equal(exportJson.exportSummary.exportedProfileItems, allProfileItems.length);
  assert.equal(exportJson.exportSummary.usableProfileItems, 625);
  assert.equal(exportJson.exportSummary.retractedProfileItems, 1);

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
    status: undefined,
  });
  assert.deepEqual(exportRequests.at(-1), {
    phase: 'export',
    limit: 200,
    offset: 1200,
    status: 'all',
  });

  await page.locator('.status-message.success', {
    hasText: '画像导出文件已生成',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '1251/1251 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '含 1 条已排除审计',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt.receipt-success', {
    hasText: '画像导出回执',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '导出已重新分页拉取全部画像状态',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '本地 JSON 不会恢复、删除、同步或发送画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '文件已生成并交给浏览器下载',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '页面不能确认浏览器是否保存到磁盘',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '浏览器下载已请求',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '磁盘保存未校验',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: 'active + confirmed',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '全部状态 1251/1251 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '可个性化 625 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '确认前保留 626 条',
  }).waitFor({ timeout: 10000 });
  const shortFingerprint = exportJson.exportInfo.manifest.integrity.profileItemsSha256.slice(0, 12);
  const manifestId = exportJson.exportInfo.manifest.manifestId;
  await page.locator('.profile-export-receipt', {
    hasText: `manifest 指纹 ${shortFingerprint}`,
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: `指纹 ${shortFingerprint}`,
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '系统健康和实体统计诊断已写入本地导出 JSON',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: `manifest ID ${manifestId}`,
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: 'manifest ID 已显示',
  }).waitFor({ timeout: 10000 });

  phase = 'export-partial-diagnostics';
  const [partialDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button.export-btn').click(),
  ]);
  const partialExportPath = await partialDownload.path();
  assert.ok(partialExportPath, 'partial export download should resolve to a local path');
  const partialExportJson = JSON.parse(await fs.readFile(partialExportPath, 'utf8'));
  assert.equal(partialExportJson.userProfile.items.length, allProfileItems.length);
  assert.equal(partialExportJson.exportInfo.profileAudit.retractedItems, 1);
  assert.equal(partialExportJson.exportInfo.pagination.truncated, false);
  assert.equal(partialExportJson.exportInfo.warnings.length, 2);
  assert.equal(partialExportJson.exportInfo.manifest.scope.diagnosticWarnings, 2);
  assert.equal(
    partialExportJson.exportInfo.manifest.integrity.profileItemsSha256,
    sha256Hex(partialExportJson.userProfile.items),
  );
  assert.equal(partialExportJson.exportInfo.optionalSections.systemHealth.available, false);
  assert.equal(partialExportJson.exportInfo.optionalSections.entityStatistics.available, false);
  assert.equal(partialExportJson.systemStatus.healthAvailable, false);
  assert.equal(partialExportJson.entityStatistics.statsAvailable, false);
  assert.equal(partialExportJson.exportSummary.dataQuality, '部分诊断缺失');
  const partialManifestId = partialExportJson.exportInfo.manifest.manifestId;
  await page.locator('.status-message.info', {
    hasText: '2 个诊断项未同步',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt.receipt-info', {
    hasText: '画像导出文件已生成，诊断部分缺失',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '画像条目已写入本地导出 JSON',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '缺失的系统健康或实体统计会记录在 exportInfo.warnings',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: `manifest ID ${partialManifestId}`,
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '诊断缺失 2 项',
  }).waitFor({ timeout: 10000 });

  phase = 'export-failure';
  await page.locator('button.export-btn').click();
  await page.locator('.status-message.error', {
    hasText: 'fixture profile export unavailable',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt.receipt-warning', {
    hasText: '画像导出未完成',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: 'fixture profile export unavailable',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '没有生成新的本地 JSON、manifest ID 或浏览器下载请求',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '旧的成功回执或旧文件不能证明本次导出完成',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '不会恢复、删除、同步、发送画像，也不会改写 Memory Service',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-export-receipt', {
    hasText: '未请求下载',
  }).waitFor({ timeout: 10000 });

  phase = 'overview-star-confirm';
  await page.locator('.profile-filter-control select').first().selectOption('all');
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Zzz Boost Pending Project');
  await page.locator('.profile-items-summary', {
    hasText: '显示 1/1 条匹配结果（共 1250 条）',
  }).waitFor({ timeout: 10000 });
  const projectTwoProfileRow = page.locator('.profile-item-row').filter({
    has: page.locator('.profile-item-name', { hasText: /^Zzz Boost Pending Project$/ }),
  }).first();
  await projectTwoProfileRow.locator('.profile-item-state', {
    hasText: '待确认',
  }).waitFor({ timeout: 10000 });
  await projectTwoProfileRow.locator('.context-use-pill', {
    hasText: '确认前不使用',
  }).waitFor({ timeout: 10000 });
  await projectTwoFocusItem.getByLabel('将 Zzz Boost Pending Project 重要性设为 5 星', { exact: true }).click();
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在设为重点：Zzz Boost Pending Project',
  }).waitFor({ timeout: 10000 });
  await projectTwoProfileRow.locator('.profile-item-state', {
    hasText: '待确认',
  }).waitFor({ timeout: 10000 });
  await projectTwoProfileRow.locator('.context-use-pill', {
    hasText: '确认前不使用',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '重要性已更新',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-success', {
    hasText: '已设为重点：Zzz Boost Pending Project',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可用于个性化',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-2), {
    type: 'update',
    id: 'profile-export-2',
    body: {
      confidence: 1,
      salienceScore: 1,
      status: 'active',
    },
  });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'confirm',
    id: 'profile-export-2',
  });

  phase = 'initial-load';
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: '将创建 偏好 · RingCentral 回复风格',
  }).waitFor({ timeout: 10000 });
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: 'active + confirmed 画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: '不会外发、恢复旧画像或跨平台同步',
  }).waitFor({ timeout: 10000 });
  await page.locator('.owner-profile-form select').nth(1).selectOption('__custom__');
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: '先补 偏好 的稳定 key',
  }).waitFor({ timeout: 10000 });
  await page.locator('.custom-profile-key-input').fill('project.personal_ai.priority');
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: '将创建 偏好 · project.personal_ai.priority，先补画像内容',
  }).waitFor({ timeout: 10000 });
  await page.locator('.owner-profile-form textarea').fill(
    'Personal AI profile calibration should surface reversible changes.',
  );
  await page.locator('.explicit-profile-entry-receipt', {
    hasText: '将创建 偏好 · project.personal_ai.priority，来源标记为用户手动录入',
  }).waitFor({ timeout: 10000 });
  await assertAttributeMatches(
    explicitProfileSubmitButton,
    'aria-label',
    /提交会创建 active \+ confirmed 手动画像：偏好 · project\.personal_ai\.priority/,
    'explicit profile submit should expose write boundary before submit',
  );
  phase = 'create-pending-receipt';
  await page.locator('.owner-profile-form button.primary-action-btn').click();
  await page.locator('.status-message', {
    hasText: '正在添加主人表达画像',
  }).waitFor({ timeout: 10000 });
  await assertAttributeMatches(
    explicitProfileSubmitButton,
    'aria-label',
    /正在提交 偏好 · project\.personal_ai\.priority 到 Memory Service/,
    'explicit profile submit should expose service-confirmation pending boundary',
  );
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在添加显式画像：project.personal_ai.priority',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '请求完成前还不能证明 偏好 画像已写入',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '不会外发、恢复旧画像、跨平台同步或发送内容',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '主人表达画像已添加',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已添加显式画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '用户录入',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可用于个性化',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '场景个性化候选',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '不会外发、恢复旧画像或跨平台同步',
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

  phase = 'confirm-pending-receipt';
  await page.locator('.profile-filter-control select').first().selectOption('all');
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 990');
  const confirmTargetRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 990',
  });
  await confirmTargetRow.waitFor({ timeout: 10000 });
  await confirmTargetRow.locator('button.secondary-action-btn', { hasText: '确认' }).click();
  await page.locator('.status-message', {
    hasText: '正在确认画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在确认画像：Export Project 990',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '请求完成前还不能证明状态已切换为 active + confirmed',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '画像条目已确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-success', {
    hasText: '已确认画像：Export Project 990',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'confirm',
    id: 'profile-export-990',
  });

  phase = 'boost-confirm-failure';
  await page.locator('.profile-filter-control select').first().selectOption('all');
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 996');
  const boostFailureRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 996',
  });
  await boostFailureRow.waitFor({ timeout: 10000 });
  await boostFailureRow.locator('.profile-action-impact-receipt', {
    hasText: '设为重点会同时确认；降低影响只改权重并保持待确认',
  }).waitFor({ timeout: 10000 });
  const boostFailureButton = boostFailureRow.locator('button.influence-action-btn', {
    hasText: '设为重点',
  });
  await assertAttributeMatches(
    boostFailureButton,
    'aria-label',
    /设为重点 Export Project 996：当前影响力 80%，目标影响力 95%。这是画像条目列表中的快速校准。会先写入新的 confidence\/salience，再尝试确认成 active \+ confirmed/,
    'boost button should expose confirm-after-update boundary',
  );
  await assertAttributeMatches(
    boostFailureButton,
    'title',
    /服务确认前不能证明已写入或进入个性化；不会改旧回答、刷新或删除证据、排除\/恢复画像、外发、跨平台同步、导出或发送内容/,
    'boost hover should expose service-confirmation and non-effect boundary',
  );
  await boostFailureButton.click();
  await page.locator('.status-message.info', {
    hasText: '影响力已更新，确认未完成',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-warning', {
    hasText: '已更新影响力，确认未完成：Export Project 996',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '确认前这条不会进入 USER_CORE、召回或 provider context',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可点确认重试',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-2), {
    type: 'update',
    id: 'profile-export-996',
    body: {
      confidence: 0.95,
      salienceScore: 0.95,
      status: 'active',
    },
  });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'confirm-failed',
    id: 'profile-export-996',
  });

  phase = 'influence-update-failure';
  await page.locator('.profile-filter-control select').first().selectOption('all');
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 997');
  const updateFailureRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 997',
  });
  await updateFailureRow.waitFor({ timeout: 10000 });
  await updateFailureRow.locator('.profile-action-impact-receipt', {
    hasText: '该条已确认，本次只改影响力',
  }).waitFor({ timeout: 10000 });
  const updateFailureLowerButton = updateFailureRow.locator('button.influence-action-btn', {
    hasText: '降低影响',
  });
  await assertAttributeMatches(
    updateFailureLowerButton,
    'aria-label',
    /降低影响 Export Project 997：当前影响力 80%，目标影响力 25%。这是画像条目列表中的快速校准。只写入新的 confidence\/salience；该条已确认，后续仍按场景选择是否使用/,
    'lower button for confirmed item should expose influence-only boundary',
  );
  await updateFailureLowerButton.click();
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在降低影响：Export Project 997',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.error', {
    hasText: 'fixture profile update unavailable',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-warning', {
    hasText: '画像校准未完成：Export Project 997',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '服务没有确认新的 confidence/salience 写入',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可重试校准',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'update-failed',
    id: 'profile-export-997',
    body: {
      confidence: 0.25,
      salienceScore: 0.25,
    },
  });

  phase = 'lower-without-confirm';
  await page.locator('.profile-filter-control select').first().selectOption('all');
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 998');
  const confirmFailureRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 998',
  });
  await confirmFailureRow.waitFor({ timeout: 10000 });
  await confirmFailureRow.locator('.profile-action-impact-receipt', {
    hasText: '降低影响只改权重并保持待确认',
  }).waitFor({ timeout: 10000 });
  const lowerWithoutConfirmButton = confirmFailureRow.locator('button.influence-action-btn', {
    hasText: '降低影响',
  });
  await assertAttributeMatches(
    lowerWithoutConfirmButton,
    'aria-label',
    /降低影响 Export Project 998：当前影响力 80%，目标影响力 25%。这是画像条目列表中的快速校准。只写入新的 confidence\/salience，不会自动确认；确认前不会进入 USER_CORE、召回或 provider context/,
    'lower button for unconfirmed item should expose no-auto-confirm boundary',
  );
  await lowerWithoutConfirmButton.click();
  await page.locator('.status-message.info', {
    hasText: '已降低画像影响',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '已降低影响，仍待确认：Export Project 998',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '该条仍未确认，确认前不会进入 USER_CORE、召回或 provider context',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可点确认复核',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'update',
    id: 'profile-export-998',
    body: {
      confidence: 0.25,
      salienceScore: 0.25,
    },
  });
  assert.equal(
    profileMutations.some(
      (mutation) => mutation.type === 'confirm-failed' && mutation.id === 'profile-export-998',
    ),
    false,
    'lowering influence should not try to confirm an unconfirmed profile item',
  );

  phase = 'calibration-pending-success';
  await page.getByPlaceholder('名称、键、来源、状态或证据').fill('Export Project 999');
  const undoTargetRow = page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  });
  await undoTargetRow.waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '当前影响力 80%',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '设为重点(95%) / 降低影响(25%) 会更新 confidence/salience',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '该条已确认，本次只改影响力',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '2 条证据保留',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '只影响后续画像选择',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: 'active + confirmed 才进入个性化',
  }).waitFor({ timeout: 10000 });
  const undoTargetLowerButton = undoTargetRow.locator('button.influence-action-btn', {
    hasText: '降低影响',
  });
  await assertAttributeMatches(
    undoTargetLowerButton,
    'title',
    /降低影响 Export Project 999：当前影响力 80%，目标影响力 25%。这是画像条目列表中的快速校准。只写入新的 confidence\/salience；该条已确认/,
    'lower button hover should include target and confirmed-only write boundary',
  );
  await undoTargetLowerButton.click();
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在降低影响：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '请求完成前还不能证明画像已写入或已进入个性化',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '已降低画像影响',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已降低影响：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '影响力 25%',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '该条已确认，后续仍只会按场景进入个性化上下文',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'update',
    id: 'profile-export-999',
    body: {
      confidence: 0.25,
      salienceScore: 0.25,
    },
  });
  assert.equal(
    profileMutations.some(
      (mutation) => mutation.type === 'confirm' && mutation.id === 'profile-export-999',
    ),
    false,
    'lowering influence on an already-confirmed item should not make a redundant confirm request',
  );

  phase = 'influence-undo';
  await page.locator('.profile-calibration-receipt-actions', {
    hasText: '恢复到 80%',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt-actions', {
    hasText: '只恢复影响力，不撤销确认、证据、旧回答或外部同步',
  }).waitFor({ timeout: 10000 });
  await page.locator('button.compact-action-btn', {
    hasText: '撤销影响力调整',
  }).waitFor({ timeout: 10000 });
  const undoInfluenceButton = page.locator('button.compact-action-btn', {
    hasText: '撤销影响力调整',
  });
  await assertAttributeMatches(
    undoInfluenceButton,
    'aria-label',
    /撤销影响力调整：将 Export Project 999 的 confidence\/salience 从 25% 恢复到 80%。只恢复影响力，不撤销确认状态、证据、旧回答、排除、恢复、外部同步、导出或发送内容；服务确认前不能证明已恢复/,
    'undo influence button should expose reversible-scope boundary',
  );
  await undoInfluenceButton.click();
  await page.locator('.status-message.info', {
    hasText: '正在撤销画像影响力调整',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在撤销影响力调整：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '只恢复影响力，不撤销确认状态、不排除画像、不刷新证据',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '已撤销画像影响力调整',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已撤销影响力调整：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '影响力 80%',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '仅撤销权重',
  }).waitFor({ timeout: 10000 });
  await undoTargetRow.locator('.profile-action-impact-receipt', {
    hasText: '当前影响力 80%',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'update',
    id: 'profile-export-999',
    body: {
      confidence: 0.8,
      salienceScore: 0.8,
    },
  });

  phase = 'retract-pending-receipt';
  await undoTargetRow.locator('button.danger-action-btn').click();
  await page.locator('.status-message', {
    hasText: '正在排除画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-warning', {
    hasText: '正在排除画像：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '请求完成前还不能证明这条已退出个性化',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '已排除“Export Project 999”',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已排除画像：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '不参与个性化',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可撤销 / 可恢复',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'delete',
    id: 'profile-export-999',
  });

  phase = 'restore-pending-receipt';
  await page.locator('.status-action-btn', { hasText: '撤销排除' }).click();
  await page.locator('.status-message', {
    hasText: '正在恢复画像条目',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt.receipt-info', {
    hasText: '正在恢复画像：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '请求完成前还不能证明这条已恢复',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '等待服务确认',
  }).waitFor({ timeout: 10000 });
  await page.locator('.status-message.success', {
    hasText: '已恢复“Export Project 999”',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已恢复画像：Export Project 999',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已回到可用画像',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'restore',
    id: 'profile-export-999',
    status: 'active',
  });
  await page.locator('.profile-item-row', {
    hasText: 'Export Project 999',
  }).waitFor({ timeout: 10000 });

  phase = 'retracted-list-failure';
  await page.locator('button.retracted-items-toggle-btn', {
    hasText: '查看已排除',
  }).click();
  await page.locator('.profile-retracted-audit-receipt.receipt-warning', {
    hasText: '已排除画像读取失败',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: 'fixture retracted profile unavailable',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '不能证明没有已排除画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '未恢复画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section .inline-empty.warning-empty', {
    hasText: '当前没有可验证快照',
  }).waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.retracted-profile-section .inline-empty', {
      hasText: '暂无已排除画像条目',
    }).count(),
    0,
    'failed retracted audit should not render as an empty confirmed snapshot',
  );

  await page.locator('button.retracted-items-toggle-btn', {
    hasText: '收起已排除',
  }).click();

  phase = 'retracted-list';
  await page.locator('button.retracted-items-toggle-btn', {
    hasText: '查看已排除',
  }).click();
  await page.locator('.profile-retracted-audit-receipt.receipt-info', {
    hasText: '正在读取已排除画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '请求 status=retracted',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '不能证明没有已排除画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section', {
    hasText: 'Archived Project Alpha',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt.receipt-success', {
    hasText: '已读取已排除画像',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '快照 1/1 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: 'status=retracted',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '只有单独点击“恢复”才会提交恢复请求',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section', {
    hasText: '已排除，不参与个性化',
  }).waitFor({ timeout: 10000 });
  const retractedEvidenceButton = page.locator('.retracted-profile-section button.evidence-toggle-btn');
  await retractedEvidenceButton.click();
  await page.locator('.retracted-profile-section .profile-evidence-scope-receipt', {
    hasText: '证据审计',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section .profile-evidence-scope-receipt', {
    hasText: '不会确认画像、写入 USER_CORE、刷新来源、同步外部平台或发送内容',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section .profile-evidence-panel', {
    hasText: 'This project was excluded by mistake.',
  }).waitFor({ timeout: 10000 });
  const retractedRequests = profileItemRequests.filter(
    (request) => request.phase === 'retracted-list',
  );
  assert.deepEqual(retractedRequests, [
    {
      phase: 'retracted-list',
      limit: 200,
      offset: 0,
      status: 'retracted',
    },
  ]);

  await page.locator('.retracted-profile-section button.secondary-action-btn', {
    hasText: '恢复',
  }).click();
  await page.locator('.status-message.success', {
    hasText: '已恢复“Archived Project Alpha”',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '已恢复画像：Archived Project Alpha',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-calibration-receipt', {
    hasText: '可用于个性化',
  }).waitFor({ timeout: 10000 });
  assert.deepEqual(profileMutations.at(-1), {
    type: 'restore',
    id: 'profile-retracted-1',
    status: 'active',
  });
  await page.locator('.profile-retracted-audit-receipt.receipt-info', {
    hasText: '已排除画像快照为空',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '快照 0/0 条',
  }).waitFor({ timeout: 10000 });
  await page.locator('.profile-retracted-audit-receipt', {
    hasText: '需要重新确认全库时，可收起后再次打开重新读取',
  }).waitFor({ timeout: 10000 });
  await page.locator('.retracted-profile-section', {
    hasText: '暂无已排除画像条目',
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
