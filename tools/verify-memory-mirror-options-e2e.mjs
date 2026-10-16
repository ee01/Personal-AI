/**
 * E2E check for the AutoBackupSettings GitHub mirror UI (issue E-79):
 *   - one master toggle in Toggle style (ToggleField), config hidden when off
 *   - channel selector rendered as a tab bar (role=tab), not action buttons
 *   - GitHub mirror panel has no separate enable checkbox
 *   - selected channel tab survives a page reload (localStorage)
 *
 * Runs the built extension (dist/) against a local mock memory-service.
 * Usage: node tools/verify-memory-mirror-options-e2e.mjs
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../desktop-app/package.json', import.meta.url));
const { chromium } = require('playwright');

const diagnostics = [];
const hits = [];

const runtimeConfig = {
  autoBackupEnabled: false,
  autoBackupScheduleType: 'daily',
  autoBackupPreferredHour: 3,
  autoBackupProvider: 'webdav',
  autoBackupGithubRepo: 'esone/memory-mirror',
  autoBackupGithubBranch: 'main',
  autoBackupGithubMode: 'markdown',
  autoBackupGithubScope: 'all',
  autoBackupGithubPrefix: '',
  autoBackupGithubTokenConfigured: true,
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  hits.push(`${req.method} ${url.pathname}`);
  let body = '';
  for await (const chunk of req) body += chunk;
  if (url.pathname === '/api/v1/config') {
    res.end(JSON.stringify(runtimeConfig));
    return;
  }
  if (url.pathname === '/api/v1/backup/status') {
    res.end(
      JSON.stringify({
        enabled: runtimeConfig.autoBackupEnabled,
        provider: 'webdav',
        scheduleType: 'daily',
        preferredHour: 3,
        intervalHours: 24,
        retentionCount: 7,
        encryptionEnabled: true,
        encryptionConfigured: true,
        includeDerived: true,
        includeVectors: true,
        prefix: 'personal-ai-backups',
        lastBackup: null,
        lastAttemptAt: null,
        nextEstimatedAt: null,
        consecutiveFailures: 0,
        history: [],
        volume: { dbBytes: 0, tables: [], vectorBytes: 0, vectorShare: 0 },
      }),
    );
    return;
  }
  if (url.pathname === '/api/v1/backup/mirror/status') {
    res.end(
      JSON.stringify({
        enabled: false,
        repo: runtimeConfig.autoBackupGithubRepo,
        branch: 'main',
        tokenConfigured: true,
        mode: 'markdown',
        scope: 'all',
        prefix: '',
        encryptionConfigured: true,
        manifestFiles: 0,
        lastRun: null,
      }),
    );
    return;
  }
  if (url.pathname === '/api/v1/backup/mirror/preview') {
    res.end(
      JSON.stringify({
        files: [{ path: 'mirror/MIRROR.md', bytes: 800, hash: 'x' }],
        receipt: {
          generatedAt: new Date().toISOString(),
          scope: 'all',
          filesTotal: 1,
          excludedByPolicy: 0,
          excludedByScope: 0,
          exclusions: [],
          counts: { preferences: 0, facts: 0, decisions: 0, superseded: 0, openLoopsClosed: 0 },
          commitMessage: 'memory mirror fixture',
        },
      }),
    );
    return;
  }
  if (url.pathname === '/api/v1/backup/mirror/test-connection') {
    res.end(JSON.stringify({ ok: true, detail: '连接正常（fixture）' }));
    return;
  }
  res.end(JSON.stringify({}));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-mirror-options-'));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${path.resolve('dist')}`,
      `--load-extension=${path.resolve('dist')}`,
    ],
    viewport: { width: 1200, height: 1400 },
  });
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await worker.evaluate(async (base) => {
    await chrome.storage.local.set({
      envConfig: {
        MEMORY_SERVICE_BASE_URL: base,
        MEMORY_SERVICE_API_KEY: 'fixture-key',
        MEMORY_SERVICE_BOOTSTRAP_KEY: '',
      },
      userinfo: { username: 'mirror-fixture' },
      memoryServiceDeviceKey: {
        userId: 'mirror-fixture',
        token: 'fixture-key',
        id: 'fixture',
        deviceId: 'fixture',
        keyPrefix: 'fixture',
        label: 'fixture',
        createdAt: Date.now(),
      },
    });
  }, `http://127.0.0.1:${port}/api/v1`);

  const page = await context.newPage();
  page.on('pageerror', (e) => diagnostics.push(`ERROR ${e.message}`));
  await page.goto(new URL('options.html', worker.url()).href);

  // Locate the AutoBackup card and wait for it to hydrate. The card is the
  // innermost .form-section whose heading is 自动备份 (the parent Memory
  // Service section also mentions it), so take the last match.
  const card = page
    .locator('.form-section', { has: page.getByRole('heading', { name: '自动备份' }) })
    .last();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800); // let config loads settle

  // 1. Master switch is a ToggleField (id + green track), not a bare checkbox.
  const masterToggle = card.locator('#autoBackupEnabled');
  assert.ok(await masterToggle.count() === 1, 'master toggle input#autoBackupEnabled missing');
  const trackColor = await card
    .locator('label:has(#autoBackupEnabled) span[aria-hidden="true"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  diagnostics.push(`master toggle track color (unchecked): ${trackColor}`);
  assert.notEqual(
    trackColor,
    'rgb(46, 204, 113)',
    'unchecked toggle should not be green yet',
  );

  // 2. With the master switch off, no channel config is rendered at all.
  assert.equal(
    await card.locator('[role="tablist"]').count(),
    0,
    'channel tabs must be hidden while the master switch is off',
  );
  assert.equal(await card.locator('[role="tab"]').count(), 0, 'no tabs expected when off');
  assert.equal(await card.getByText('WebDAV 推送').count(), 0, 'no WebDAV config when off');
  await page.screenshot({ path: 'test-results/e79-options-master-off.png', fullPage: false });

  // 3. Turn the master switch on: config area appears as a tab bar.
  // (The checkbox itself is visually hidden inside the toggle; click the
  // toggle's label/track instead.)
  await card.locator('label:has(#autoBackupEnabled)').first().click();
  await page.waitForTimeout(300);
  const tablist = card.locator('[role="tablist"]');
  assert.ok((await tablist.count()) === 1, 'tablist not rendered after enabling');
  const tabs = card.locator('[role="tab"]');
  const tabNames = (await tabs.allTextContents()).map((t) => t.trim());
  diagnostics.push(`tabs: ${tabNames.join(' | ')}`);
  assert.deepEqual(tabNames, ['WebDAV 推送', 'S3 兼容推送', '个人电脑拉取', 'GitHub 镜像']);
  // A configured mirror repo auto-selects the GitHub tab (the old bug was the
  // tab snapping back to webdav/s3 because autoBackupProvider never becomes
  // 'github').
  assert.equal(
    await tabs.filter({ hasText: 'GitHub 镜像' }).first().getAttribute('aria-selected'),
    'true',
    'GitHub tab should be auto-selected when a mirror repo is configured',
  );
  const trackColorOn = await card
    .locator('label:has(#autoBackupEnabled) span[aria-hidden="true"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  assert.equal(
    trackColorOn,
    'rgb(46, 204, 113)',
    'checked toggle track should be green (Toggle style)',
  );

  // 4. Select the GitHub mirror tab: no separate enable checkbox in the panel.
  await tabs.filter({ hasText: 'GitHub 镜像' }).click();
  await page.waitForTimeout(300);
  const githubTab = tabs.filter({ hasText: 'GitHub 镜像' });
  assert.equal(
    await githubTab.first().getAttribute('aria-selected'),
    'true',
    'GitHub tab must be selected after click',
  );
  const panelText = await card.innerText();
  const repoInput = card.locator('input[placeholder="esone/memory-mirror"]');
  assert.equal(
    await repoInput.inputValue(),
    'esone/memory-mirror',
    'repo field should show saved repo',
  );
  assert.equal(
    await card.locator('input[type="checkbox"]:visible').count(),
    1,
    'only the master toggle checkbox should be visible in the GitHub panel',
  );
  assert.equal(
    await card.locator('#autoBackupGithubEnabled').count(),
    0,
    'the redundant per-channel mirror checkbox must be gone',
  );
  assert.ok(
    panelText.includes('随「自动备份」总开关生效'),
    'panel should state it rides the master switch',
  );
  await page.screenshot({ path: 'test-results/e79-options-github-tab.png', fullPage: false });

  // 5. Reload: the saved tab must still be selected. The master switch is
  // off again in the fixture config, so re-enable it first (this also proves
  // the hide-when-off behavior survives reloads).
  await page.reload();
  await card.waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800);
  assert.equal(
    await card.locator('[role="tablist"]').count(),
    0,
    'tabs must be hidden again after reload while the master switch is off',
  );
  await card.locator('label:has(#autoBackupEnabled)').first().click();
  await page.waitForTimeout(300);
  const tabsAfterReload = card.locator('[role="tab"]');
  assert.equal(await tabsAfterReload.count(), 4, 'tabs missing after reload');
  assert.equal(
    await tabsAfterReload.filter({ hasText: 'GitHub 镜像' }).first().getAttribute('aria-selected'),
    'true',
    'GitHub tab must remain selected after page reload',
  );
  assert.ok(
    (await repoInput.inputValue()) === 'esone/memory-mirror',
    'saved repo must still be visible after reload',
  );

  // 6. The page loaded its config from the service (mock was hit).
  assert.ok(hits.some((h) => h.includes('GET /api/v1/config')), 'GET /config not observed');
  assert.ok(
    hits.some((h) => h.includes('/api/v1/backup/mirror/status')),
    'GET /backup/mirror/status not observed',
  );

  console.log('PASS: mirror options UI checks');
  console.log(`requests observed: ${[...new Set(hits)].join(', ')}`);
  if (diagnostics.length) console.log(`diagnostics:\n  ${diagnostics.join('\n  ')}`);
} catch (error) {
  console.error('FAIL:', error.message);
  if (diagnostics.length) console.error(`diagnostics:\n  ${diagnostics.join('\n  ')}`);
  process.exitCode = 1;
} finally {
  await context?.close();
  server.close();
  await fs.rm(profile, { recursive: true, force: true });
}
