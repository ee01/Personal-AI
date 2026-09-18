/**
 * Renders the packaged desktop settings page against a stubbed bridge API and
 * asserts the Memory Service 设备密钥 row: status wording, the reissue round
 * trip, and the layout fix that keeps its help text off the inputs.
 *
 * Run with: npm --prefix desktop-app run test:device-key-ui
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..', 'app');

function log(message) {
  console.log(`[device-key-ui] ${message}`);
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function serveApp() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname =
        requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
      const filePath = resolve(appDir, `.${decodeURIComponent(pathname)}`);
      if (!filePath.startsWith(`${appDir}/`) && filePath !== appDir) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(404);
      response.end(error instanceof Error ? error.message : 'Not found');
    }
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { server, url: `http://127.0.0.1:${address.port}/index.html` };
}

function credential(keyPrefix) {
  return {
    outcome: {
      status: 'ok',
      keyPrefix,
      label: 'Desktop · darwin · abcdef',
      createdAt: 1_789_000_000,
    },
    hasToken: true,
    deviceId: 'dev_0123456abcdef',
    label: 'Desktop · darwin · abcdef',
    checkedAt: 1_789_000_000_000,
  };
}

async function installStubs(page, { initialCredential, reissuedCredential }) {
  await page.addInitScript(
    ({ initial, reissued }) => {
      const noop = () => undefined;
      const settings = {
        uiLanguage: 'zh-CN',
        memoryServiceBaseUrl: 'http://127.0.0.1:3210',
        memoryServiceUserId: 'tester',
        memoryServiceApiKey: 'service-key',
        autoSync: true,
        pollIntervalMs: 300_000,
        stableMemoryIntervalMs: 43_200_000,
        mobileBriefingIntervalMs: 14_400_000,
        reminderSyncIntervalMs: 900_000,
        reminderDailyDigestEnabled: true,
        reminderDailyDigestTime: '09:00',
        reminderDedupSameDay: true,
        explorer: {
          doubao: { enabled: false, lookbackDays: 7, intervalMinutes: 60, defaultScope: 'personal' },
          chatgpt: { enabled: false, maxConversations: 0, lookbackDays: 0, intervalMinutes: 60, defaultScope: 'work' },
          codex_cli: { enabled: false, rootPaths: [], lookbackDays: 30, intervalMinutes: 60, maxSessions: 50, includeSubagents: false, defaultScope: 'work' },
          claude_code_cli: { enabled: false, rootPaths: [], lookbackDays: 30, intervalMinutes: 60, maxSessions: 50, includeSubagents: true, defaultScope: 'work' },
          cursor_agent_cli: { enabled: false, rootPaths: [], lookbackDays: 30, intervalMinutes: 60, maxSessions: 50, includeSubagents: true, defaultScope: 'work' },
          autoClassify: false,
          askDefaultScope: 'work',
        },
        worker: {},
        backupPull: { enabled: false, hour: 8, retentionCount: 7, encrypt: true },
      };

      window.__deviceKeyCalls = { reissue: 0, get: 0, updateSettings: 0 };
      let current = initial;

      window.bridgeApi = {
        pair: async () => ({ token: 'stub' }),
        getHealth: async () => ({ ok: true }),
        getStatus: async () => ({
          appVersion: '5.0.0',
          authStatus: 'connected',
          memoryServiceConfigured: true,
          memoryCredential: current,
          autoSyncEnabled: true,
          blockingReasons: [],
          threads: [],
          bindings: {},
          syncReadiness: {
            stableMemory: { ready: true, reasons: [], intervalMs: 43_200_000 },
            mobileBriefing: { ready: true, reasons: [], intervalMs: 14_400_000 },
            reminderSync: { ready: true, reasons: [], intervalMs: 900_000 },
          },
          syncState: {
            timerActive: true,
            running: false,
            autoSyncEnabled: true,
            memoryServiceConfigured: true,
            pollIntervalMs: 300_000,
            recentAttempts: [],
            tasks: {
              stableMemory: { intervalMs: 43_200_000, due: false },
              mobileBriefing: { intervalMs: 14_400_000, due: false },
              reminderSync: { intervalMs: 900_000, due: false },
            },
          },
          setupChecklist: {
            memoryServiceConfigured: true,
            autoSyncEnabled: true,
            doubaoConnected: true,
            memorySyncBound: true,
            mobileContextBound: true,
          },
        }),
        getSettings: async () => ({ defaults: settings, user: {}, effective: settings }),
        updateSettings: async () => {
          window.__deviceKeyCalls.updateSettings += 1;
          return { defaults: settings, user: {}, effective: settings };
        },
        testMemoryService: async () => ({ ok: true, baseUrl: settings.memoryServiceBaseUrl }),
        getMemoryCredential: async () => {
          window.__deviceKeyCalls.get += 1;
          return current;
        },
        reissueMemoryCredential: async () => {
          window.__deviceKeyCalls.reissue += 1;
          current = reissued;
          return current;
        },
        pullBackupNow: async () => ({ status: 'succeeded' }),
        openLogin: async () => ({ ok: true }),
        createMemorySyncThread: async () => ({ ok: true }),
        autoBindMobileThread: async () => ({ ok: true }),
        runNow: async () => ({ ok: true }),
      };

      window.explorerApi = {
        getStatus: async () => ({ sources: {} }),
        openLogin: async () => ({ ok: true }),
        preview: async () => ({ items: [] }),
        resetCache: async () => ({ ok: true }),
        revokeIngestedMemory: async () => ({ ok: true }),
        runNow: async () => ({ ok: true }),
      };

      window.appShell = {
        getMeta: async () => ({ version: '5.0.0', background: false }),
        getVoicePreferences: async () => ({}),
        onShortcutStatus: () => noop,
        openAccessibilitySettings: noop,
        openExternal: noop,
        openInputMonitoringSettings: noop,
        openLogFile: noop,
        openMemoryListWindow: noop,
        openMicrophoneSettings: noop,
        openSpeechRecognitionSettings: noop,
        refreshShortcutHelper: noop,
        stopBackgroundAndQuit: noop,
        openSupportDir: noop,
      };
    },
    { initial: initialCredential, reissued: reissuedCredential },
  );
}

async function main() {
  const { server, url } = await serveApp();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  try {
    await installStubs(page, {
      initialCredential: credential('pak.dGVzdGVy.aaa111'),
      reissuedCredential: credential('pak.dGVzdGVy.bbb222'),
    });
    await page.goto(url);

    const status = page.locator('#memory-device-key-status');
    const detail = page.locator('#memory-device-key-detail');
    const reissue = page.locator('#memory-device-key-reissue');

    await status.waitFor({ state: 'attached' });
    await page.waitForFunction(
      () =>
        !document
          .getElementById('memory-device-key-status')
          ?.textContent?.includes('检查中'),
      undefined,
      { timeout: 10_000 },
    );

    const before = (await status.textContent())?.trim();
    assert.ok(
      before?.includes('pak.dGVzdGVy.aaa111'),
      `status should show the issued prefix, got ${JSON.stringify(before)}`,
    );
    assert.ok(
      await status.evaluate((node) => node.classList.contains('is-ok')),
      'an issued key should render in the success tone',
    );
    log(`initial status: ${before}`);

    const memoryCard = page.locator('[data-collapse-id="memory"]');
    if (await memoryCard.evaluate((node) => node.classList.contains('is-collapsed'))) {
      await memoryCard.locator('[data-collapse-toggle]').click();
      await page.waitForFunction(
        () =>
          !document
            .querySelector('[data-collapse-id="memory"]')
            ?.classList.contains('is-collapsed'),
        undefined,
        { timeout: 5_000 },
      );
    }
    await detail.scrollIntoViewIfNeeded();

    // The generic `.compact-field small` rule pins unit hints on top of the
    // input; the device-key help text must opt out of that.
    const detailPosition = await detail.evaluate(
      (node) => getComputedStyle(node).position,
    );
    assert.equal(detailPosition, 'static', 'help text must not be overlaid');

    const apiKeyBox = await page.locator('#memory-api-key').boundingBox();
    const detailBox = await detail.boundingBox();
    const statusBox = await status.boundingBox();
    assert.ok(apiKeyBox && detailBox && statusBox, 'all rows should be visible');
    assert.ok(
      detailBox.y >= apiKeyBox.y + apiKeyBox.height,
      'help text should sit below the API Key input, not on top of it',
    );
    assert.ok(
      detailBox.y >= statusBox.y + statusBox.height - 1,
      'help text should sit below the status row',
    );
    log('layout: help text renders on its own line below the inputs');

    await reissue.click();
    await page.waitForFunction(
      () =>
        document
          .getElementById('memory-device-key-status')
          ?.textContent?.includes('bbb222'),
      undefined,
      { timeout: 10_000 },
    );

    const after = (await status.textContent())?.trim();
    assert.ok(after?.includes('pak.dGVzdGVy.bbb222'), 'status should show the new key');
    assert.notEqual(before, after, 'reissue must change the shown key');
    log(`after reissue: ${after}`);

    const message = (
      await page.locator('#settings-message').textContent()
    )?.trim();
    assert.ok(
      message?.includes('设备密钥已签发'),
      `expected a success receipt, got ${JSON.stringify(message)}`,
    );
    log(`receipt: ${message}`);

    const calls = await page.evaluate(() => window.__deviceKeyCalls);
    assert.equal(calls.reissue, 1, 'reissue should be requested exactly once');
    assert.ok(
      calls.updateSettings >= 1,
      'pending settings edits should be saved before reissuing',
    );

    assert.deepEqual(consoleErrors, [], 'the settings page must not throw');
    log('PASS');
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

main().catch((error) => {
  console.error('[device-key-ui] FAILED');
  console.error(error);
  process.exit(1);
});
