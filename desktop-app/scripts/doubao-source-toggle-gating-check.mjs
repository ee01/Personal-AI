import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const staticRoot = path.join(appRoot, 'app');

const now = new Date('2026-05-11T09:00:00.000Z').toISOString();

function createEffectiveSettings(explorerOverride = {}) {
  return {
    memoryServiceBaseUrl: '',
    memoryServiceUserId: '',
    memoryServiceApiKey: '',
    autoSync: true,
    pollIntervalMs: 300_000,
    stableMemoryIntervalMs: 43_200_000,
    mobileBriefingIntervalMs: 14_400_000,
    reminderSyncIntervalMs: 900_000,
    explorer: {
      askDefaultScope: 'work',
      doubao: {
        enabled: true,
        lookbackDays: 7,
        intervalMinutes: 60,
        defaultScope: 'personal',
        transport: 'playwright',
        broadcastTransport: 'playwright',
      },
      chatgpt: {
        enabled: true,
        lookbackDays: 0,
        intervalMinutes: 60,
        maxConversations: 0,
        defaultScope: 'work',
        transport: 'playwright',
      },
      ...explorerOverride,
    },
  };
}

function createStatus() {
  return {
    paired: true,
    authStatus: 'needs_login',
    browserRunning: false,
    bindings: {},
    threads: [],
    blockingReasons: [
      {
        code: 'memory_service_not_configured',
        message:
          '还没有连接 Memory Service <img src=x onerror="window.__paiInjected=1">',
        syncKinds: ['stableMemory', 'mobileBriefing', 'reminderSync'],
      },
    ],
    setupChecklist: {
      memoryServiceConfigured: false,
      autoSyncEnabled: true,
      doubaoConnected: false,
      memorySyncBound: false,
      mobileContextBound: false,
    },
    syncState: {
      timerActive: false,
      running: false,
      autoSyncEnabled: true,
      memoryServiceConfigured: false,
      pollIntervalMs: 300_000,
      recentAttempts: [
        {
          id: 'attempt-mobile-1',
          kind: 'mobile_briefing',
          trigger: 'manual',
          status: 'succeeded',
          startedAt: now,
          completedAt: now,
          durationMs: 1200,
          externalThreadId: 'mobile-context-thread-1234567890',
          packageKinds: ['active_focus_digest'],
          sourceRefCount: 2,
          transportUsed: 'dom',
          transportMode: 'webpage_mcp',
          verified: true,
          messageVisible: true,
          challengeDetected: false,
          telemetryError: 'Sync job report failed: endpoint timeout',
        },
        {
          id: 'attempt-reminder-failed',
          kind: 'reminder_sync',
          trigger: 'auto',
          status: 'failed',
          startedAt: now,
          completedAt: now,
          durationMs: 900,
          errorMessage: 'Doubao challenge detected before send',
          packageKinds: ['todo_digest'],
          sourceRefCount: 1,
          transportUsed: 'dom',
          transportMode: 'playwright',
          transportFallbackReason: 'No existing doubao.com tab found in Chrome',
          verified: false,
          messageVisible: false,
          challengeDetected: true,
        },
      ],
      tasks: {
        stableMemory: {
          intervalMs: 43_200_000,
          due: true,
        },
        mobileBriefing: {
          intervalMs: 14_400_000,
          due: true,
        },
        reminderSync: {
          intervalMs: 900_000,
          due: true,
        },
      },
    },
  };
}

function createExplorerStatus() {
  return {
    updatedAt: now,
    sources: {
      doubao: {
        enabled: true,
        authStatus: 'needs_login',
        running: false,
        lastRunOutcome: 'error',
        lastError: 'Doubao login required before running explorer collection.',
        cache: {
          messageCount: 12,
          conversationCount: 3,
        },
        settings: createEffectiveSettings().explorer.doubao,
        transport: {
          mode: 'playwright',
        },
      },
      chatgpt: {
        enabled: true,
        authStatus: 'needs_login',
        running: false,
        lastRunOutcome: undefined,
        cache: {
          messageCount: 5,
          conversationCount: 2,
        },
        settings: createEffectiveSettings().explorer.chatgpt,
        transport: {
          mode: 'playwright',
        },
      },
    },
  };
}

async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const requestPath =
        url.pathname === '/'
          ? '/index.html'
          : decodeURIComponent(url.pathname);
      if (requestPath === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const filePath = path.resolve(staticRoot, `.${requestPath}`);
      if (!filePath.startsWith(`${staticRoot}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }

      const body = await fs.readFile(filePath);
      const extname = path.extname(filePath);
      const contentType =
        extname === '.html'
          ? 'text/html; charset=utf-8'
          : extname === '.js' || extname === '.mjs'
            ? 'text/javascript; charset=utf-8'
            : extname === '.css'
              ? 'text/css; charset=utf-8'
              : 'application/octet-stream';
      response.writeHead(200, { 'content-type': contentType });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    server,
    url: `http://127.0.0.1:${address.port}/index.html`,
  };
}

async function main() {
  const staticServer = await startStaticServer();
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
  });
  const page = await browser.newPage();
  const diagnostics = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      diagnostics.push(`console error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    diagnostics.push(
      `page error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  await page.addInitScript(
    ({ status, settings, explorerStatus }) => {
      window.__paiInjected = false;
      window.__lastUpdateSettings = null;
      window.__lastRevokeMemory = null;
      window.__lastExplorerRunNow = null;
      window.__actionSequence = [];
      window.__effectiveSettings = settings;
      window.__status = status;
      window.__explorerStatus = explorerStatus;
      window.confirm = () => true;
      window.bridgeApi = {
        getStatus: async () => window.__status,
        getSettings: async () => ({
          effective: window.__effectiveSettings,
        }),
        updateSettings: async (payload) => {
          window.__actionSequence.push('updateSettings');
          window.__lastUpdateSettings = payload;
          window.__effectiveSettings = {
            ...window.__effectiveSettings,
            ...payload,
            explorer:
              payload.explorer ?? window.__effectiveSettings.explorer,
          };
          return {
            effective: window.__effectiveSettings,
          };
        },
        testMemoryService: async () => ({
          ok: false,
          error: 'Memory Service not configured',
        }),
        openLogin: async () => {
          window.__actionSequence.push('openLogin');
          return {
            url: 'https://www.doubao.com/',
            browserTransport: window.__status.browserTransport,
          };
        },
        createMemorySyncThread: async () => ({
          id: 'memory-thread',
          title: '长期记忆同步线程',
        }),
        autoBindMobileThread: async () => ({
          threadId: 'mobile-thread',
          title: '手机版对话',
        }),
        runNow: async () => ({
          status: 'skipped',
        }),
      };
      window.explorerApi = {
        getStatus: async () => window.__explorerStatus,
        testWebpageMcpConnection: async () => ({
          ok: false,
          error: 'not connected',
        }),
        openLogin: async () => ({
          implemented: true,
          url: 'https://www.doubao.com/',
        }),
        runNow: async (source) => {
          window.__actionSequence.push(`runNow:${source}`);
          window.__lastExplorerRunNow = { source };
          return {
            implemented: true,
            insertedCount: 0,
            extractedConversationCount: 1,
            extractedMessageCount: 2,
            artifactCount: 1,
            skippedConversationCount: 0,
          };
        },
        revokeIngestedMemory: async (source, scope) => {
          window.__lastRevokeMemory = { source, scope };
          return {
            source,
            scope,
            deletedMessages: 2,
            deletedChunks: 3,
          };
        },
      };
      window.appShell = {
        getMeta: async () => ({
          version: 'test',
          bridgeLogFile: '/tmp/personal-ai.log',
          supportDir: '/tmp/personal-ai',
        }),
        getVoicePreferences: async () => ({
          voiceLocale: 'zh-CN',
        }),
        setVoicePreferences: async (preferences) => preferences,
        onShortcutStatus: () => undefined,
        openMemoryListWindow: () => undefined,
        openLogFile: () => undefined,
        openSupportDir: () => undefined,
        openExternal: () => undefined,
        openInputMonitoringSettings: () => undefined,
        openAccessibilitySettings: () => undefined,
        openMicrophoneSettings: () => undefined,
        refreshShortcutHelper: async () => ({}),
        stopBackgroundAndQuit: async () => undefined,
      };
    },
    {
      status: createStatus(),
      settings: createEffectiveSettings(),
      explorerStatus: createExplorerStatus(),
    },
  );

  try {
    await page.goto(staticServer.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#doubao-source-enabled');

    try {
      await page.waitForFunction(
        () => {
          const input = document.querySelector('#doubao-source-enabled');
          return input?.checked === true && input?.disabled === true;
        },
        null,
        { timeout: 5_000 },
      );
    } catch (error) {
      const state = await page.evaluate(() => {
        const input = document.querySelector('#doubao-source-enabled');
        return {
          checked: input?.checked,
          disabled: input?.disabled,
          statusText: document.querySelector('#doubao-source-toggle-status')
            ?.textContent,
          reasonText: document.querySelector('#blocking-reasons')?.textContent,
          bridgeApiLoaded: Boolean(window.bridgeApi),
          explorerApiLoaded: Boolean(window.explorerApi),
        };
      });
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nState: ${JSON.stringify(
          state,
        )}\nDiagnostics: ${diagnostics.join('\n')}`,
      );
    }

    const statusText = await page.locator('#doubao-source-toggle-status').textContent();
    assert.match(statusText || '', /已开启/);
    assert.match(statusText || '', /Memory Service/);
    await expectText(page, '#doubao-source-run-state', /最近失败/);
    await expectText(
      page,
      '#doubao-source-status-message',
      /最近一次自动读取失败：Doubao login required before running explorer collection/,
    );
    await expectText(
      page,
      '#doubao-source-status-message',
      /请点击“登录来源”重新登录，然后再立即抓取/,
    );
    await expectText(
      page,
      '#chatgpt-source-status-message',
      /ChatGPT 自动读取已开启，但还没有可用登录态/,
    );

    assert.equal(await page.evaluate(() => window.__paiInjected), false);
    assert.equal(await page.locator('#blocking-reasons img').count(), 0);
    assert.equal(await page.locator('#doubao-source-revoke-button').isDisabled(), true);
    await expectText(page, '#sync-audit-list', /近期记忆重点/);
    await expectText(page, '#sync-audit-list', /包：近期重点包/);
    await expectText(page, '#sync-audit-list', /来源引用：2/);
    await expectText(page, '#sync-audit-list', /线程：mobile-c...567890/);
    await expectText(page, '#sync-audit-list', /已验证 · 消息可见 · 传输：日常 Chrome/);
    await expectText(page, '#sync-audit-list', /状态回写异常：Sync job report failed/);
    await expectText(page, '#sync-audit-list', /待办 \/ 通知/);
    await expectText(page, '#sync-audit-list', /Doubao challenge detected before send/);
    await expectText(page, '#sync-audit-list', /传输：内置 Chromium/);
    await expectText(page, '#sync-audit-list', /回退原因：No existing doubao\.com tab found in Chrome/);
    await expectText(page, '#sync-audit-list', /打开豆包检查/);
    await expectText(page, '#sync-audit-list', /重新绑定手机对话/);
    await expectText(page, '#sync-audit-list', /重试待办 \/ 通知/);

    await page
      .locator('[data-sync-audit-action="open_doubao"]')
      .first()
      .click();
    await page.waitForFunction(() => window.__actionSequence.includes('openLogin'));

    await page.locator('#doubao-source-lookback-days').fill('9');
    await page.waitForFunction(
      () => !document.querySelector('#doubao-source-save-button')?.disabled,
    );
    await page.locator('#doubao-source-save-button').click();
    await page.waitForFunction(
      () => window.__lastUpdateSettings?.explorer?.doubao?.lookbackDays === 9,
    );

    const savedDoubaoSettings = await page.evaluate(
      () => window.__lastUpdateSettings.explorer.doubao,
    );
    assert.equal(savedDoubaoSettings.enabled, true);
    assert.equal(savedDoubaoSettings.lookbackDays, 9);

    await page.evaluate(() => {
      window.__lastUpdateSettings = null;
      window.__lastExplorerRunNow = null;
      window.__actionSequence = [];
      window.__explorerStatus = {
        ...window.__explorerStatus,
        sources: {
          ...window.__explorerStatus.sources,
          doubao: {
            ...window.__explorerStatus.sources.doubao,
            authStatus: 'connected',
          },
        },
      };
    });
    await page.locator('#refresh-button').click();
    await page.waitForFunction(
      () => !document.querySelector('#doubao-source-run-button')?.disabled,
    );
    await page.locator('#doubao-source-lookback-days').fill('11');
    await page.locator('#doubao-source-use-daily-browser').check();
    await page.waitForFunction(
      () => !document.querySelector('#doubao-source-save-button')?.disabled,
    );
    await page.locator('#doubao-source-run-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerRunNow?.source === 'doubao',
    );
    const manualRunState = await page.evaluate(() => ({
      actionSequence: window.__actionSequence,
      savedDoubaoSettings: window.__lastUpdateSettings?.explorer?.doubao,
      runNow: window.__lastExplorerRunNow,
    }));
    assert.deepEqual(manualRunState.actionSequence, [
      'updateSettings',
      'runNow:doubao',
    ]);
    assert.equal(manualRunState.savedDoubaoSettings.enabled, true);
    assert.equal(manualRunState.savedDoubaoSettings.lookbackDays, 11);
    assert.equal(
      manualRunState.savedDoubaoSettings.transport,
      'webpage_mcp',
    );
    assert.deepEqual(manualRunState.runNow, { source: 'doubao' });
    await expectText(
      page,
      '#doubao-source-message',
      /豆包对话抓取完成：新增 0 条缓存消息，提炼 2 条消息 \/ 1 个对话，写入 1 条记忆/,
    );

    await page.evaluate(() => {
      const fallbackCooldownUntil = new Date(
        Date.now() + 10 * 60_000,
      ).toISOString();
      const nextDoubaoSettings = {
        ...window.__effectiveSettings.explorer.doubao,
        transport: 'webpage_mcp',
        broadcastTransport: 'webpage_mcp',
      };
      window.__effectiveSettings = {
        ...window.__effectiveSettings,
        explorer: {
          ...window.__effectiveSettings.explorer,
          doubao: nextDoubaoSettings,
        },
      };
      window.__status = {
        ...window.__status,
        authStatus: 'connected',
        browserTransport: {
          mode: 'playwright',
          preferredMode: 'webpage_mcp',
          fallbackReason: 'No existing doubao.com tab found in Chrome',
          fallbackCooldownUntil,
        },
      };
      window.__explorerStatus = {
        ...window.__explorerStatus,
        sources: {
          ...window.__explorerStatus.sources,
          doubao: {
            ...window.__explorerStatus.sources.doubao,
            authStatus: 'connected',
            settings: nextDoubaoSettings,
            transport: {
              mode: 'playwright',
              fallbackReason: 'No existing doubao.com tab found in Chrome',
              fallbackCooldownUntil,
            },
          },
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(
      page,
      '#broadcast-transport-status',
      /当前广播传输：已临时回退到内置 Chromium/,
    );
    await expectText(page, '#broadcast-transport-status', /约 \d+ 分钟后自动重试日常浏览器/);
    await expectText(
      page,
      '#broadcast-transport-status',
      /打开 Chrome 豆包.*立即重新尝试/,
    );
    await expectText(
      page,
      '#doubao-source-transport-banner',
      /当前传输：已临时回退到内置 Chromium/,
    );
    await expectText(page, '#doubao-source-transport-banner', /登录来源.*立即重新尝试/);

    await page.evaluate(() => {
      window.__status = {
        ...window.__status,
        blockingReasons: [],
        setupChecklist: {
          ...window.__status.setupChecklist,
          memoryServiceConfigured: true,
        },
      };
    });
    await page.locator('#refresh-button').click();
    await page.waitForFunction(
      () => !document.querySelector('#doubao-source-revoke-button')?.disabled,
    );
    await page.locator('#doubao-source-revoke-button').click();
    await page.waitForFunction(
      () => window.__lastRevokeMemory?.source === 'doubao',
    );
    const revokePayload = await page.evaluate(() => window.__lastRevokeMemory);
    assert.deepEqual(revokePayload, {
      source: 'doubao',
      scope: 'personal',
    });
    await expectText(page, '#doubao-source-message', /已撤回 豆包/);

    assert.deepEqual(diagnostics, []);
    console.log('[doubao-source-toggle-gating] ok');
  } finally {
    await browser.close();
    await new Promise((resolve) => staticServer.server.close(resolve));
  }
}

async function expectText(page, selector, pattern) {
  const text = await page.locator(selector).textContent();
  assert.match(text || '', pattern);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
