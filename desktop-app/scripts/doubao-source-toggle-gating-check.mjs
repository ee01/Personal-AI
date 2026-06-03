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
    bindings: {
      memory_sync: {
        bindingType: 'memory_sync',
        threadId: 'memory-thread-abcdef123456',
        threadUrl: 'https://www.doubao.com/chat/memory-thread-abcdef123456',
        title: '旧长期记忆线程',
        updatedAt: now,
      },
    },
    threads: [
      {
        id: 'memory-thread-abcdef123456',
        kind: 'memory_sync',
        title: '旧长期记忆线程',
        url: 'https://www.doubao.com/chat/memory-thread-abcdef123456',
        bindingType: 'memory_sync',
        createdAt: now,
        updatedAt: now,
      },
    ],
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
      memorySyncBound: true,
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
          id: 'attempt-stable-failed',
          kind: 'stable_memory',
          trigger: 'auto',
          status: 'failed',
          startedAt: now,
          completedAt: now,
          durationMs: 1500,
          errorMessage: 'No editable element found on the current Doubao page',
          externalThreadId: 'memory-thread-abcdef123456',
          packageKinds: ['persona_core'],
          packageItemCount: 2,
          sourceRefCount: 2,
          transportUsed: 'dom',
          transportMode: 'webpage_mcp',
          verified: false,
          messageVisible: false,
          challengeDetected: false,
        },
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
          packageItemCount: 2,
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
          packageItemCount: 1,
          sourceRefCount: 1,
          reminderDeliveryMode: 'new_items',
          transportUsed: 'dom',
          transportMode: 'playwright',
          transportFallbackReason: 'No existing doubao.com tab found in Chrome',
          verified: false,
          messageVisible: false,
          challengeDetected: true,
        },
        {
          id: 'attempt-reminder-digest',
          kind: 'reminder_sync',
          trigger: 'auto',
          status: 'succeeded',
          startedAt: now,
          completedAt: now,
          durationMs: 1100,
          packageKinds: ['todo_digest'],
          packageItemCount: 3,
          sourceRefCount: 3,
          reminderDeliveryMode: 'daily_digest',
          transportUsed: 'dom',
          transportMode: 'playwright',
          verified: true,
          messageVisible: true,
          challengeDetected: false,
        },
        {
          id: 'attempt-reminder-skipped',
          kind: 'reminder_sync',
          trigger: 'manual',
          status: 'skipped',
          startedAt: now,
          completedAt: now,
          durationMs: 400,
          errorMessage:
            'No pending todos to sync / Notice sync is not supported by Memory Service',
          packageKinds: ['todo_digest'],
          packageItemCount: 0,
          sourceRefCount: 0,
          reminderDeliveryMode: 'manual',
        },
      ],
      tasks: {
        stableMemory: {
          intervalMs: 43_200_000,
          due: true,
          lastRunAt: now,
          nextDueAt: '2026-05-11T21:00:00.000Z',
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
          pendingExtractCount: 4,
          artifactCount: 8,
          revokedArtifactCount: 1,
        },
        revokePreview: {
          scope: 'personal',
          activeArtifactCount: 8,
          legacyUnscopedArtifactCount: 2,
          revokedArtifactCount: 1,
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
          pendingExtractCount: 1,
          artifactCount: 3,
          revokedArtifactCount: 0,
        },
        revokePreview: {
          scope: 'work',
          activeArtifactCount: 3,
          legacyUnscopedArtifactCount: 0,
          revokedArtifactCount: 0,
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
      window.__lastExplorerPreview = null;
      window.__lastExplorerResetCache = null;
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
            localArtifactsRevoked: 8,
            localLegacyArtifactsRevoked: 2,
          };
        },
        preview: async ({ source, conversationId, limit } = {}) => {
          window.__lastExplorerPreview = { source, conversationId, limit };
          return {
            source,
            conversationId: conversationId || `${source}-conv-1`,
            limit,
            cache: window.__explorerStatus.sources[source].cache,
            conversations: [
              {
                source,
                conversationId: `${source}-conv-1`,
                latestTs: '2026-05-11T08:58:00.000Z',
                messageCount: 3,
                pendingMessageCount: 1,
                extractedMessageCount: 2,
                artifactCount: 1,
                latestMessagePreview: 'hello cached prompt',
              },
            ],
            cleanedMessages: [
              {
                source,
                conversationId: `${source}-conv-1`,
                messageId: 'msg-1',
                role: 'user',
                ts: '2026-05-11T08:57:00.000Z',
                content: 'hello cached prompt',
                extracted: true,
              },
              {
                source,
                conversationId: `${source}-conv-1`,
                messageId: 'msg-2',
                role: 'assistant',
                ts: '2026-05-11T08:58:00.000Z',
                content: 'assistant cached answer',
                extracted: false,
              },
            ],
            artifacts: [
              {
                source,
                conversationId: `${source}-conv-1`,
                extractedAt: '2026-05-11T08:59:00.000Z',
                kind: 'fact',
                text: 'Follow up extracted memory',
                sourceQuote: 'hello cached prompt',
                conversationRef: `${source}-conv-1`,
              },
            ],
            cursor: {
              source,
              conversationId: `${source}-conv-1`,
              lastMessageId: 'msg-2',
              lastProcessedUpdateTime: '2026-05-11T08:58:00.000Z',
              processedMessageIds: ['msg-1', 'msg-2'],
            },
          };
        },
        resetCache: async (source, conversationId) => {
          window.__lastExplorerResetCache = { source, conversationId };
          window.__explorerStatus = {
            ...window.__explorerStatus,
            sources: {
              ...window.__explorerStatus.sources,
              [source]: {
                ...window.__explorerStatus.sources[source],
                cache: {
                  messageCount: 0,
                  conversationCount: 0,
                  pendingExtractCount: 0,
                  artifactCount: 0,
                },
              },
            },
          };
          return {
            source,
            conversationId,
            deletedMessages: 12,
            deletedCursors: 2,
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
    await expectText(page, '#doubao-source-pending-count', /^4$/);
    await expectText(page, '#doubao-source-artifact-count', /8（已撤回 1）/);
    await expectText(
      page,
      '#doubao-source-revoke-scope',
      /个人 · 可撤回 8 条本地 artifact · 含旧审计 2 · 已撤回 1/,
    );
    await expectText(page, '#chatgpt-source-pending-count', /^1$/);
    await expectText(page, '#chatgpt-source-artifact-count', /^3$/);
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
    await expectText(page, '#memory-thread-detail', /长期记忆线程需要检查/);
    await expectText(page, '#memory-thread-detail', /旧长期记忆线程/);
    await expectText(
      page,
      '#memory-thread-detail',
      /最近长期记忆同步：失败 · 自动/,
    );
    await expectText(
      page,
      '#memory-thread-detail',
      /No editable element found on the current Doubao page/,
    );
    await expectText(page, '#memory-thread-detail', /修复长期记忆线程/);
    await expectText(page, '#memory-thread-detail', /重试长期记忆/);

    assert.equal(await page.evaluate(() => window.__paiInjected), false);
    assert.equal(await page.locator('#blocking-reasons img').count(), 0);
    assert.equal(await page.locator('#doubao-source-revoke-button').isDisabled(), true);
    assert.equal(await page.locator('#doubao-source-preview-button').isDisabled(), false);
    assert.equal(await page.locator('#doubao-source-reset-button').isDisabled(), false);

    await page.locator('#doubao-source-preview-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerPreview?.source === 'doubao',
    );
    const previewPayload = await page.evaluate(() => window.__lastExplorerPreview);
    assert.deepEqual(previewPayload, {
      source: 'doubao',
      conversationId: undefined,
      limit: 6,
    });
    await expectText(page, '#doubao-source-preview-panel', /豆包 本地缓存预览/);
    await expectText(page, '#doubao-source-preview-panel', /hello cached prompt/);
    await expectText(page, '#doubao-source-preview-panel', /Follow up extracted memory/);
    await expectText(page, '#doubao-source-preview-panel', /lastMessageId=msg-2/);

    await page.locator('#doubao-source-reset-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerResetCache?.source === 'doubao',
    );
    const resetPayload = await page.evaluate(() => window.__lastExplorerResetCache);
    assert.deepEqual(resetPayload, {
      source: 'doubao',
      conversationId: undefined,
    });
    await expectText(page, '#doubao-source-message', /已重置 豆包 本地缓存/);
    await expectText(page, '#doubao-source-message', /清理 12 条缓存消息/);
    assert.equal(await page.locator('#doubao-source-preview-panel').isHidden(), true);
    await expectText(page, '#doubao-source-cache-count', /^0$/);
    await expectText(page, '#sync-audit-list', /近期记忆重点/);
    await expectText(page, '#sync-audit-list', /包：近期重点包/);
    await expectText(page, '#sync-audit-list', /内容条目：2/);
    await expectText(page, '#sync-audit-list', /来源引用：2/);
    await expectText(page, '#sync-audit-list', /线程：mobile-c...567890/);
    await expectText(page, '#sync-audit-list', /已验证 · 消息可见 · 传输：日常 Chrome/);
    await expectText(page, '#sync-audit-list', /状态回写异常：Sync job report failed/);
    await expectText(page, '#sync-audit-list', /待办 \/ 通知/);
    await expectText(page, '#sync-audit-list', /内容条目：1/);
    await expectText(page, '#sync-audit-list', /待办模式：新待办短轮询/);
    await expectText(page, '#sync-audit-list', /Doubao challenge detected before send/);
    await expectText(page, '#sync-audit-list', /传输：内置 Chromium/);
    await expectText(page, '#sync-audit-list', /回退原因：No existing doubao\.com tab found in Chrome/);
    await expectText(page, '#sync-audit-list', /打开豆包检查/);
    await expectText(page, '#sync-audit-list', /重新绑定手机对话/);
    await expectText(page, '#sync-audit-list', /重试待办 \/ 通知/);
    await expectText(page, '#sync-audit-list', /内容条目：3/);
    await expectText(page, '#sync-audit-list', /待办模式：每日完整摘要/);
    await expectText(page, '#sync-audit-list', /内容条目：0/);
    await expectText(page, '#sync-audit-list', /待办模式：手动完整推送/);
    await expectText(page, '#sync-audit-list', /本次没有可推送的待办/);
    await expectText(page, '#sync-audit-list', /当前 Memory Service 暂不支持通知同步/);

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
      const fallbackCooldownUntil = new Date(
        Date.now() + 9 * 60_000,
      ).toISOString();
      const nextChatgptSettings = {
        ...window.__effectiveSettings.explorer.chatgpt,
        transport: 'webpage_mcp',
      };
      window.__effectiveSettings = {
        ...window.__effectiveSettings,
        explorer: {
          ...window.__effectiveSettings.explorer,
          chatgpt: nextChatgptSettings,
        },
      };
      window.__explorerStatus = {
        ...window.__explorerStatus,
        sources: {
          ...window.__explorerStatus.sources,
          chatgpt: {
            ...window.__explorerStatus.sources.chatgpt,
            authStatus: 'connected',
            settings: nextChatgptSettings,
            transport: {
              mode: 'playwright',
              fallbackReason: 'No existing chatgpt.com tab found in Chrome',
              fallbackCooldownUntil,
            },
          },
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(
      page,
      '#chatgpt-source-transport-banner',
      /当前传输：已临时回退到内置 Chromium/,
    );
    await expectText(
      page,
      '#chatgpt-source-transport-banner',
      /No existing chatgpt\.com tab found in Chrome/,
    );
    await expectText(
      page,
      '#chatgpt-source-transport-banner',
      /约 \d+ 分钟后自动重试日常浏览器/,
    );

    await page.evaluate(() => {
      window.__savedExplorerStatus = window.__explorerStatus;
      window.__explorerStatus = {
        ...window.__explorerStatus,
        sources: {
          ...window.__explorerStatus.sources,
        },
      };
      delete window.__explorerStatus.sources.doubao;
    });
    await page.locator('#refresh-button').click();
    await expectText(page, '#doubao-source-run-state', /Explorer 未响应/);
    await expectText(
      page,
      '#doubao-source-status-message',
      /Explorer 状态暂不可用/,
    );
    assert.equal(
      await page.locator('#doubao-source-transport-banner').isHidden(),
      true,
    );
    assert.equal(
      await page.locator('#doubao-source-transport-banner').textContent(),
      '',
    );

    await page.evaluate(() => {
      window.__explorerStatus = window.__savedExplorerStatus;
      delete window.__savedExplorerStatus;
    });
    await page.locator('#refresh-button').click();

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
    await expectText(page, '#doubao-source-message', /本地 8 条 artifact/);
    await expectText(page, '#doubao-source-message', /旧审计 2 条/);

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
