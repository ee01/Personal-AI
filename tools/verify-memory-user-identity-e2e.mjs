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
  storageKey: 'data/users/owner.alpha/memory.db',
  fallbackToDefault: false,
};

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
    await route.fulfill(jsonResponse(apiFallback(route.request().url())));
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = new URL(worker.url()).host;
  assert.ok(extensionId, 'extension id should be available');

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/memory-exploring.html`, {
    waitUntil: 'domcontentloaded',
  });

  await page.getByText('当前记忆用户').waitFor({ timeout: 10000 });
  await page.locator('.memory-user-value', { hasText: 'owner.alpha' }).waitFor({
    timeout: 10000,
  });
  assert.equal(
    await page.locator('.memory-user-status.warning').count(),
    0,
    'explicit user identity should not render fallback warning',
  );

  currentIdentity = {
    id: 'default',
    isolation: 'per_user_sqlite',
    storageKey: 'data/users/default/memory.db',
    fallbackToDefault: true,
  };
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.locator('.memory-user-value', { hasText: 'default' }).waitFor({
    timeout: 10000,
  });
  await page
    .getByText('未解析到个人身份，正在使用 default 空间。')
    .waitFor({ timeout: 10000 });
  assert.equal(
    await page.locator('.memory-user-status.warning').count(),
    1,
    'default fallback identity should render a visible warning',
  );

  console.log('memory user identity e2e passed');
} finally {
  await context.close().catch(() => undefined);
  await fs.rm(userDataDir, { recursive: true, force: true });
}
