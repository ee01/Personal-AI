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
  path.join(os.tmpdir(), 'personal-ai-memory-user-identity-'),
);

let currentIdentity = {
  id: 'owner.alpha',
  isolation: 'per_user_sqlite',
  identitySource: 'header',
  storageKey: 'data/users/owner.alpha/memory.db',
  fallbackToDefault: false,
};
const statsUserHeaders = [];

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function emptyList() {
  return { items: [], total: 0, limit: 50, offset: 0 };
}

async function waitForCondition(predicate, message, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}

function statsFixture() {
  return {
    user: currentIdentity,
    messages: { total: 0, today: 0, thisWeek: 0, last90Days: 0 },
    entities: { total: 0, byType: {} },
    chunks: { total: 0 },
    relationships: { total: 0 },
    watchedProjects: { active: 0 },
    notifications: { pending: 0, sentToday: 0 },
    confirmRequests: { pending: 0 },
    memory: {
      temporary: 0,
      working: 0,
      consolidated: 0,
      core: 0,
      forgotten: 0,
      archived: 0,
    },
  };
}

function apiFallback(url) {
  const pathname = new URL(url).pathname;
  if (pathname.endsWith('/stats')) return statsFixture();
  if (pathname.endsWith('/meetings')) return emptyList();
  if (pathname.endsWith('/confirm-requests')) return emptyList();
  if (pathname.endsWith('/reflection-threads')) return emptyList();
  if (pathname.endsWith('/actions')) return emptyList();
  if (pathname.endsWith('/config/runtime')) return { outreachEnabled: false };
  if (pathname.endsWith('/outreach/summary')) {
    return { upcomingCount: 0, waitingReplyCount: 0, escalatedCount: 0 };
  }
  if (pathname.endsWith('/outreach/templates/runtime-status')) return emptyList();
  if (pathname.endsWith('/skills')) return emptyList();
  if (pathname.endsWith('/skills/suggestions')) return emptyList();
  if (pathname.endsWith('/day-pilot/today')) return { cards: [], missions: [] };
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
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/stats')) {
      const actualUserHeader = request.headers()['x-user-id'] ?? null;
      statsUserHeaders.push(actualUserHeader);
    }
    await route.fulfill(jsonResponse(apiFallback(request.url())));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      userinfo: { username: 'owner.alpha' },
    });
  });

  let page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByText('当前记忆用户').waitFor({ timeout: 10000 });
  await page.locator('.memory-user-value', { hasText: 'owner.alpha' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('.memory-user-storage', {
      hasText: 'data/users/owner.alpha/memory.db',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.memory-user-source', {
      hasText: '身份来源: 已解析并发送 X-User-Id',
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByText('读写、备份与恢复只作用于这个 per-user SQLite 空间。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/身份快照 .* 来自只读 \/stats；刷新只重新检查身份边界。/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前统计来自 owner.alpha')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.stats-identity-source', {
      hasText: '身份来源: 已解析并发送 X-User-Id',
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByText(
      'Today Mission 和顶部统计只读取这个 per-user SQLite 空间；不会迁移、导入、恢复或写回其他用户空间。',
    )
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.memory-user-status.warning').count(),
    0,
    'explicit user identity should not render fallback warning',
  );
  assert.ok(
    statsUserHeaders.includes('owner.alpha'),
    'explicit identity should send X-User-Id to stats',
  );
  const explicitStatsCount = statsUserHeaders.length;
  await page.getByRole('button', { name: '刷新身份快照' }).click();
  await waitForCondition(
    () => statsUserHeaders.length > explicitStatsCount,
    'refreshing explicit identity should request stats again',
  );

  await page.close();
  statsUserHeaders.length = 0;

  currentIdentity = {
    id: 'default',
    isolation: 'per_user_sqlite',
    identitySource: 'default_fallback',
    storageKey: 'data/users/default/memory.db',
    fallbackToDefault: true,
  };

  await worker.evaluate(async () => {
    await chrome.storage.local.remove('userinfo');
  });

  page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`, {
    waitUntil: 'domcontentloaded',
  });

  await page.locator('.memory-user-value', { hasText: 'default' }).waitFor({
    timeout: 10000,
  });
  await page
    .locator('.memory-user-storage', {
      hasText: 'data/users/default/memory.db',
    })
    .waitFor({ timeout: 10000 });
  await page
    .locator('.memory-user-source', {
      hasText: '身份来源: 未解析，本次只读请求回退到 default',
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByText('仅只读兼容回退；写入、导入、恢复会被拦截，直到身份恢复。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText('未解析到个人身份，正在使用 default 空间；写入会被拦截，直到身份恢复。')
    .waitFor({ timeout: 10000 });
  await page
    .getByText(/身份快照 .* 来自只读 \/stats；刷新只重新检查身份边界。/)
    .waitFor({ timeout: 10000 });
  await page
    .getByText('当前统计来自 default 只读回退')
    .waitFor({ timeout: 10000 });
  await page
    .locator('.stats-identity-source', {
      hasText: '身份来源: 未解析，/stats 本次回退到 default',
    })
    .waitFor({ timeout: 10000 });
  await page
    .getByText('这是只读兼容快照；写入、导入和恢复仍会被拦截，直到身份恢复。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.memory-user-status.warning').count(),
    1,
    'default fallback identity should render a visible warning',
  );
  assert.ok(
    statsUserHeaders.includes(null),
    'unresolved default identity should omit X-User-Id from stats',
  );
  const fallbackStatsCount = statsUserHeaders.length;
  await page.getByRole('button', { name: '刷新身份快照' }).click();
  await waitForCondition(
    () => statsUserHeaders.length > fallbackStatsCount,
    'refreshing fallback identity should request stats again without X-User-Id',
  );
  assert.equal(
    statsUserHeaders.at(-1),
    null,
    'fallback identity refresh should still omit X-User-Id from stats',
  );

  const settingsPagePromise = context.waitForEvent('page');
  await page.getByRole('button', { name: '打开设置' }).click();
  const settingsPage = await settingsPagePromise;
  await settingsPage.waitForLoadState('domcontentloaded');
  assert.ok(
    settingsPage.url().includes('/options.html'),
    'open settings action should launch the extension options page',
  );
  await settingsPage.close();

  console.log('memory user identity e2e passed');
} finally {
  await context.close().catch(() => undefined);
  await fs.rm(userDataDir, { recursive: true, force: true });
}
