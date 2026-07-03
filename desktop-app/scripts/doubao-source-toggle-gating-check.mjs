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
    settings: {
      memoryServiceBaseUrl: '',
      memoryServiceUserId: '',
      autoSync: true,
      pollIntervalMs: 300_000,
      stableMemoryIntervalMs: 43_200_000,
      mobileBriefingIntervalMs: 14_400_000,
      reminderSyncIntervalMs: 900_000,
      reminderDailyDigestEnabled: true,
      reminderDailyDigestTime: '09:00',
      reminderDedupSameDay: true,
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
      window.__lastConfirmMessage = null;
      window.__holdRevokeMemory = false;
      window.__releaseRevokeMemory = null;
      window.__actionSequence = [];
      window.__manualSyncResults = {};
      window.__manualSyncHoldKind = null;
      window.__releaseManualSync = null;
      window.__effectiveSettings = settings;
      window.__status = status;
      window.__initialStatus = JSON.parse(JSON.stringify(status));
      window.__explorerStatus = explorerStatus;
      window.confirm = (message) => {
        window.__lastConfirmMessage = String(message || '');
        return true;
      };
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
        createMemorySyncThread: async () => {
          window.__actionSequence.push('createMemorySyncThread');
          return {
            id: 'memory-thread-abcdef123456',
            title: '旧长期记忆线程',
            url: 'https://www.doubao.com/chat/memory-thread-abcdef123456',
          };
        },
        autoBindMobileThread: async () => ({
          threadId: 'mobile-thread',
          title: '手机版对话',
        }),
        runNow: async (kind) => {
          window.__actionSequence.push(`sync:${kind}`);
          if (window.__manualSyncHoldKind === kind) {
            await new Promise((resolve) => {
              window.__releaseManualSync = () => {
                window.__manualSyncHoldKind = null;
                window.__releaseManualSync = null;
                resolve();
              };
            });
          }
          return window.__manualSyncResults?.[kind] || {
            status: 'skipped',
          };
        },
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
          const sourceSettings = window.__effectiveSettings.explorer[source] || {};
          const fallbackCooldownUntil = new Date(
            Date.now() + 10 * 60_000,
          ).toISOString();
          const transport =
            sourceSettings.transport === 'webpage_mcp'
              ? {
                  mode: 'playwright',
                  fallbackReason: `No existing ${source === 'doubao' ? 'doubao.com' : 'chatgpt.com'} tab found in Chrome`,
                  fallbackCooldownUntil,
                }
              : {
                  mode: 'playwright',
                };
          window.__explorerStatus = {
            ...window.__explorerStatus,
            sources: {
              ...window.__explorerStatus.sources,
              [source]: {
                ...window.__explorerStatus.sources[source],
                settings: sourceSettings,
                transport,
                },
            },
          };
          if (window.__holdExplorerRunSource === source) {
            await new Promise((resolve) => {
              window.__releaseExplorerRun = () => {
                window.__holdExplorerRunSource = null;
                window.__releaseExplorerRun = null;
                resolve();
              };
            });
          }
          return {
            implemented: true,
            insertedCount: 0,
            extractedConversationCount: 1,
            extractedMessageCount: 2,
            artifactCount: 1,
            skippedConversationCount: 0,
            transport,
          };
        },
        revokeIngestedMemory: async (source, scope) => {
          window.__lastRevokeMemory = { source, scope };
          if (window.__holdRevokeMemory) {
            await new Promise((resolve) => {
              window.__releaseRevokeMemory = () => {
                window.__holdRevokeMemory = false;
                window.__releaseRevokeMemory = null;
                resolve();
              };
            });
          }
          return {
            source,
            scope,
            deletedMessages: 0,
            deletedChunks: 0,
            localArtifactsRevoked: 8,
            localLegacyArtifactsRevoked: 2,
            localActiveArtifactsBefore: 8,
            localActiveArtifactsAfter: 0,
            revokeAuditState: 'local_only',
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
      '#doubao-source-pipeline-receipt',
      /输入链路：最近读取失败/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /默认范围：个人。当前仍显示上次成功留下的 12 条缓存 \/ 3 个对话、8 条活跃 artifact/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-scope',
      /个人 · 可撤回 8 条本地 artifact · 含旧审计 2 · 已撤回 1/,
    );
    await expectText(page, '#chatgpt-source-pending-count', /^1$/);
    await expectText(page, '#chatgpt-source-artifact-count', /^3$/);
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /输入链路：等待登录/,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /默认范围：工作。不会读取远端 ChatGPT 对话；现有 5 条缓存 \/ 2 个对话，仍只是本机缓存/,
    );
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
    await expectText(page, '#memory-thread-detail', /推送前会发生什么/);
    await expectText(
      page,
      '#memory-thread-detail',
      /渲染 persona_core \/ voice_mode package/,
    );
    await expectText(page, '#memory-thread-detail', /最近同步审计/);
    await expectText(page, '#memory-thread-detail', /包：Persona/);
    await expectText(page, '#memory-thread-detail', /内容条目：2/);
    await expectText(page, '#memory-thread-detail', /来源引用：2/);
    await expectText(page, '#memory-thread-detail', /未验证 · 未看到正文/);
    await expectText(page, '#memory-thread-detail', /不会进入手机版对话/);

    await page.evaluate(() => {
      window.__status = {
        ...window.__status,
        authStatus: 'connected',
        setupChecklist: {
          ...window.__status.setupChecklist,
          doubaoConnected: true,
        },
      };
    });
    await page.locator('#refresh-button').click();
    await page.waitForFunction(
      () => !document.querySelector('#memory-thread-button')?.disabled,
    );
    await page.locator('#memory-thread-button').click();
    await expectText(page, '#memory-thread-message', /绑定回执/);
    await expectText(
      page,
      '#memory-thread-message',
      /复用已绑定的长期记忆线程/,
    );
    await expectText(page, '#memory-thread-message', /没有新建第二条线程/);
    await expectText(page, '#memory-thread-message', /memory_sync_thread/);
    await expectText(
      page,
      '#memory-thread-message',
      /不同步 persona_core \/ voice_mode/,
    );
    await expectText(page, '#memory-thread-message', /不写 mobile_context_thread/);
    await expectText(page, '#memory-thread-message', /后续同步流水为准/);

    await page.evaluate(() => {
      const [stableAttempt, ...rest] = window.__status.syncState.recentAttempts;
      window.__status = {
        ...window.__status,
        syncState: {
          ...window.__status.syncState,
          recentAttempts: [
            {
              ...stableAttempt,
              status: 'succeeded',
              trigger: 'manual',
              errorMessage: '',
              telemetryError: 'Sync job report failed: endpoint timeout',
              verified: true,
              messageVisible: true,
              challengeDetected: false,
            },
            ...rest,
          ],
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(page, '#memory-thread-detail', /长期记忆线程回写需检查/);
    await expectText(page, '#memory-thread-detail', /回写异常/);
    await expectText(
      page,
      '#memory-thread-detail',
      /状态回写异常：Sync job report failed: endpoint timeout/,
    );
    await expectText(page, '#memory-thread-detail', /测试 Memory Service/);
    await expectText(page, '#memory-thread-detail', /查看日志/);
    await expectNoText(page, '#memory-thread-detail', /重试长期记忆/);

    await page.evaluate(() => {
      const stableAttempt = window.__status.syncState.recentAttempts.find(
        (attempt) => attempt.kind === 'stable_memory',
      );
      window.__stableAttemptTemplate = stableAttempt;
      window.__status = {
        ...window.__status,
        setupChecklist: {
          ...window.__status.setupChecklist,
          memoryServiceConfigured: true,
          doubaoConnected: true,
          memorySyncBound: true,
        },
        syncState: {
          ...window.__status.syncState,
          recentAttempts: window.__status.syncState.recentAttempts.filter(
            (attempt) => attempt.kind !== 'stable_memory',
          ),
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(page, '#memory-thread-detail', /长期记忆线程待首推/);
    await expectText(page, '#memory-thread-detail', /未投递/);
    await expectText(page, '#memory-thread-detail', /首次同步基线/);
    await expectText(
      page,
      '#memory-thread-detail',
      /还没有 stable_memory 自动或手动同步流水/,
    );
    await expectText(
      page,
      '#memory-thread-detail',
      /下一次自动到期或点击“现在推一次 persona”/,
    );
    await expectText(
      page,
      '#memory-thread-detail',
      /不会写 mobile_context_thread/,
    );
    await expectText(page, '#memory-thread-detail', /建线 seed/);

    await page.evaluate(() => {
      const stableAttempt =
        window.__stableAttemptTemplate ||
        window.__status.syncState.recentAttempts.find(
          (attempt) => attempt.kind === 'stable_memory',
        );
      const rest = window.__status.syncState.recentAttempts.filter(
        (attempt) => attempt.kind !== 'stable_memory',
      );
      window.__status = {
        ...window.__status,
        syncState: {
          ...window.__status.syncState,
          recentAttempts: [
            {
              ...stableAttempt,
              status: 'failed',
              trigger: 'auto',
              errorMessage: 'No editable element found on the current Doubao page',
              telemetryError: undefined,
              verified: false,
              messageVisible: false,
            },
            ...rest,
          ],
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(page, '#mobile-thread-detail', /手机上下文通道未就绪/);
    await expectText(
      page,
      '#mobile-thread-detail',
      /近期重点、待办和查询答案不会写入当前活动页/,
    );
    await expectText(page, '#mobile-thread-detail', /近期重点每 4 小时/);
    await expectText(page, '#mobile-thread-detail', /新待办每 15 分钟/);
    await expectText(page, '#mobile-thread-detail', /完整待办摘要 09:00/);
    await expectText(
      page,
      '#mobile-thread-detail',
      /最近手机上下文发送：近期记忆重点 · 已送达/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /最近手机上下文审计：包：近期重点包 · 内容条目：2 · 来源引用：2/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /线程：mobile-c\.\.\.567890/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /已验证 · 消息可见 · 传输：日常 Chrome/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /状态回写异常：Sync job report failed: endpoint timeout/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /发送前会渲染真实 Memory package 并过滤空占位/,
    );
    await expectText(page, '#mobile-thread-detail', /active_focus_digest/);
    await expectText(
      page,
      '#mobile-thread-detail',
      /手动触发按完整摘要模式/,
    );
    await expectText(
      page,
      '#mobile-thread-detail',
      /不会写入长期 persona \/ voice 线程/,
    );
    await expectText(page, '#mobile-thread-detail', /绑定手机对话/);

    await page.evaluate(() => {
      window.__manualSyncResults = {
        mobile_briefing: {
          status: 'succeeded',
          externalThreadId: 'mobile-context-thread-1234567890',
          packageKinds: ['active_focus_digest'],
          packageItemCount: 2,
          sourceRefCount: 2,
          transportUsed: 'dom',
          transportMode: 'webpage_mcp',
          verified: true,
          messageVisible: true,
          telemetryError: 'Sync job report failed',
        },
        reminder_sync: {
          status: 'skipped',
          errorMessage: 'No pending todos to sync / No notices to sync',
          packageKinds: ['todo_digest'],
          packageItemCount: 0,
          sourceRefCount: 0,
          reminderDeliveryMode: 'manual',
        },
      };
      const mobileBinding = {
        bindingType: 'mobile_context',
        threadId: 'mobile-context-thread-1234567890',
        threadUrl:
          'https://www.doubao.com/chat/mobile-context-thread-1234567890',
        title: '手机版对话',
        updatedAt: window.__status.bindings.memory_sync.updatedAt,
      };
      window.__status = {
        ...window.__status,
        authStatus: 'connected',
        blockingReasons: [],
        bindings: {
          ...window.__status.bindings,
          mobile_context: mobileBinding,
        },
        threads: [
          ...window.__status.threads,
          {
            id: mobileBinding.threadId,
            kind: 'mobile_context',
            title: mobileBinding.title,
            url: mobileBinding.threadUrl,
            bindingType: 'mobile_context',
            createdAt: mobileBinding.updatedAt,
            updatedAt: mobileBinding.updatedAt,
          },
        ],
        setupChecklist: {
          ...window.__status.setupChecklist,
          memoryServiceConfigured: true,
          doubaoConnected: true,
          mobileContextBound: true,
        },
      };
    });
    await page.locator('#refresh-button').click();
    await page.waitForFunction(
      () =>
        !document.querySelector('#run-briefing-button')?.disabled &&
        !document.querySelector('#run-reminder-button')?.disabled,
    );
    await expectText(page, '#mobile-thread-detail', /手机上下文通道回写需检查/);
    await expectText(page, '#mobile-thread-detail', /回写异常/);
    await expectText(
      page,
      '#mobile-thread-detail',
      /最近手机上下文审计：包：近期重点包 · 内容条目：2 · 来源引用：2/,
    );
    await expectText(page, '#mobile-thread-detail', /查看日志/);
    await page.evaluate(() => {
      window.__manualSyncHoldKind = 'mobile_briefing';
    });
    await page.locator('#run-briefing-button').click();
    await expectText(page, '#mobile-thread-message', /推送待确认/);
    await expectText(page, '#mobile-thread-message', /active_focus_digest/);
    await expectText(
      page,
      '#mobile-thread-message',
      /后台确认前还没有写入 mobile_context_thread/,
    );
    await expectText(
      page,
      '#mobile-thread-message',
      /不会混入长期 persona \/ voice 线程/,
    );
    await page.evaluate(() => window.__releaseManualSync?.());
    await expectText(
      page,
      '#mobile-thread-message',
      /已手动推送一次近期记忆重点到手机对话/,
    );
    await expectText(page, '#mobile-thread-message', /active_focus_digest/);
    await expectText(page, '#mobile-thread-message', /mobile_context_thread/);
    await expectText(page, '#mobile-thread-message', /本次审计/);
    await expectText(page, '#mobile-thread-message', /包：近期重点包/);
    await expectText(page, '#mobile-thread-message', /内容条目：2/);
    await expectText(page, '#mobile-thread-message', /来源引用：2/);
    await expectText(page, '#mobile-thread-message', /线程：mobile-c...567890/);
    await expectText(
      page,
      '#mobile-thread-message',
      /已验证 · 消息可见 · 传输：日常 Chrome/,
    );
    await expectText(
      page,
      '#mobile-thread-message',
      /状态回写异常：Sync job report failed/,
    );
    await expectText(
      page,
      '#mobile-thread-message',
      /不会混入长期 persona \/ voice 线程/,
    );
    await expectText(page, '#mobile-thread-message', /最近同步流水/);

    await page.evaluate(() => {
      window.__manualSyncHoldKind = 'reminder_sync';
    });
    await page.locator('#run-reminder-button').click();
    await expectText(page, '#mobile-thread-message', /推送待确认/);
    await expectText(page, '#mobile-thread-message', /手动完整摘要模式/);
    await expectText(
      page,
      '#mobile-thread-message',
      /没有把待办标记完成/,
    );
    await expectText(
      page,
      '#mobile-thread-message',
      /不会发送空占位文本/,
    );
    await page.evaluate(() => window.__releaseManualSync?.());
    await expectText(page, '#mobile-thread-message', /本次没有可推送的待办/);
    await expectText(page, '#mobile-thread-message', /本次没有可推送的通知/);
    await expectText(page, '#mobile-thread-message', /手动完整摘要模式/);
    await expectText(page, '#mobile-thread-message', /本次审计/);
    await expectText(page, '#mobile-thread-message', /包：待办包/);
    await expectText(page, '#mobile-thread-message', /内容条目：0/);
    await expectText(page, '#mobile-thread-message', /来源引用：0/);
    await expectText(page, '#mobile-thread-message', /待办模式：手动完整推送/);
    await expectText(page, '#mobile-thread-message', /不会把待办标记完成/);
    await expectText(
      page,
      '#mobile-thread-message',
      /不会在没有内容时发送占位文本/,
    );
    await page.evaluate(() => {
      window.__actionSequence = [];
      window.__status = JSON.parse(JSON.stringify(window.__initialStatus));
    });
    await page.locator('#refresh-button').click();

    assert.equal(await page.evaluate(() => window.__paiInjected), false);
    assert.equal(await page.locator('#blocking-reasons img').count(), 0);
    assert.equal(await page.locator('#doubao-source-revoke-button').isDisabled(), true);
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /撤回暂不可用：请先连接 Memory Service/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /不会删除 豆包 原始对话/,
    );
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
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /输入链路：最近读取失败/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /默认范围：个人。当前没有可用本地缓存或 artifact/,
    );
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
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /待保存输入范围：已改：回看天数/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /已保存后台仍用「自动读取开启 · 个人 · 最近 7 天 · 桌面端 Chromium profile · 每 60 分钟」/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /当前表单为「自动读取开启 · 个人 · 最近 9 天 · 桌面端 Chromium profile · 每 60 分钟」/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /后台自动读取、撤回已入库记忆和缓存统计仍按已保存设置/,
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
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /待保存输入范围：已改：回看天数、传输方式/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /已保存后台仍用「自动读取开启 · 个人 · 最近 9 天 · 桌面端 Chromium profile · 每 60 分钟」/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /当前表单为「自动读取开启 · 个人 · 最近 11 天 · 日常浏览器 doubao\.com 标签页 · 每 60 分钟」/,
    );
    await expectText(
      page,
      '#doubao-source-pipeline-receipt',
      /点击“保存来源设置”“登录来源”或“立即抓取”会先保存/,
    );
    await page.evaluate(() => {
      window.__holdExplorerRunSource = 'doubao';
    });
    await page.locator('#doubao-source-run-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerRunNow?.source === 'doubao',
    );
    await expectText(
      page,
      '#doubao-source-message',
      /抓取请求回执：已先保存待生效设置，正在按当前表单执行/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /准备按 个人 范围读取最近 11 天/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /尚未确认新的 Memory Service artifact/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /不会删除远端聊天或向 豆包 写回内容/,
    );
    await page.evaluate(() => {
      window.__releaseExplorerRun?.();
    });
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
    await expectText(
      page,
      '#doubao-source-message',
      /抓取回执：已先保存待生效设置/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /本轮按 个人 范围读取最近 11 天/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /传输偏好为 日常浏览器 doubao\.com 标签页/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /本轮实际传输：已临时回退到内置 Chromium/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /原因：No existing doubao\.com tab found in Chrome/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /不会删除远端聊天，也不会向 豆包 写回内容/,
    );

    await page.evaluate(() => {
      window.__holdExplorerRunSource = 'chatgpt';
    });
    await page.locator('#chatgpt-source-run-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerRunNow?.source === 'chatgpt',
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /抓取请求回执：使用已保存设置执行/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /准备按 工作 范围读取不限制历史天数，不限制对话数/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /尚未刷新本机 cache \/ cursor/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /不会删除远端聊天或向 ChatGPT 写回内容/,
    );
    await page.evaluate(() => {
      window.__releaseExplorerRun?.();
    });
    await expectText(
      page,
      '#chatgpt-source-message',
      /ChatGPT 输入抓取完成：新增 0 条缓存消息，提炼 2 条消息 \/ 1 个对话，写入 1 条记忆/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /本轮按 工作 范围读取不限制历史天数，不限制对话数/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /传输偏好为 桌面端 Chromium profile；本轮实际传输：内置 Chromium/,
    );
    await expectNoText(
      page,
      '#chatgpt-source-message',
      /最近 0 天/,
    );

    await page.evaluate(() => {
      window.__lastExplorerRunNow = null;
    });
    await page.locator('#chatgpt-source-use-daily-browser').check();
    await page.waitForFunction(
      () => !document.querySelector('#chatgpt-source-save-button')?.disabled,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /待保存输入范围：已改：传输方式/,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /已保存后台仍用「自动读取开启 · 工作 · 不限制历史天数 · 不限制对话数 · 桌面端 Chromium profile · 每 60 分钟」/,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /当前表单为「自动读取开启 · 工作 · 不限制历史天数 · 不限制对话数 · 日常浏览器 chatgpt\.com 标签页 · 每 60 分钟」/,
    );
    await page.evaluate(() => {
      window.__holdExplorerRunSource = 'chatgpt';
    });
    await page.locator('#chatgpt-source-run-button').click();
    await page.waitForFunction(
      () => window.__lastExplorerRunNow?.source === 'chatgpt',
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /抓取请求回执：已先保存待生效设置，正在按当前表单执行/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /准备按 工作 范围读取不限制历史天数，不限制对话数/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /传输偏好为 日常浏览器 chatgpt\.com 标签页/,
    );
    await page.evaluate(() => {
      window.__releaseExplorerRun?.();
    });
    await expectText(
      page,
      '#chatgpt-source-message',
      /抓取回执：已先保存待生效设置/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /传输偏好为 日常浏览器 chatgpt\.com 标签页/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /本轮实际传输：已临时回退到内置 Chromium/,
    );
    await expectText(
      page,
      '#chatgpt-source-message',
      /原因：No existing chatgpt\.com tab found in Chrome/,
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
      window.__explorerStatus = {
        ...window.__explorerStatus,
        sources: {
          ...window.__explorerStatus.sources,
          chatgpt: {
            ...window.__explorerStatus.sources.chatgpt,
            cache: {
              ...window.__explorerStatus.sources.chatgpt.cache,
              pendingExtractCount: 0,
            },
          },
        },
      };
    });
    await page.locator('#refresh-button').click();
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /输入链路：已有可审计记忆，缓存已处理完/,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /当前待提炼 0 条，已形成 3 条活跃 artifact/,
    );
    await expectText(
      page,
      '#chatgpt-source-pipeline-receipt',
      /不代表刚刚新增写入，只有下一轮抓到新缓存才会继续提炼或写入 Memory Service/,
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
      '#doubao-source-pipeline-receipt',
      /输入链路：暂不可判定/,
    );
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
    await expectText(
      page,
      '.source-revoke-danger:has(#doubao-source-revoke-button)',
      /按已保存默认范围撤回这个来源写入 Memory Service/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-button',
      /按已保存范围撤回记忆/,
    );
    assert.equal(
      await page.locator('#doubao-source-revoke-button').evaluate((button) =>
        button.classList.contains('danger'),
      ),
      true,
    );
    await expectText(page, '#doubao-source-revoke-status', /撤回范围回执/);
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /按已保存默认范围「个人」执行/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /工作范围与 豆包 原始对话不会被删除/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /本地可撤回 artifact 8 条/,
    );
    await expectText(
      page,
      '#doubao-source-revoke-status',
      /旧版无 scope 审计 2 条/,
    );
    await page.evaluate(() => {
      window.__holdRevokeMemory = true;
    });
    await page.locator('#doubao-source-revoke-button').click();
    await page.waitForFunction(
      () => window.__lastRevokeMemory?.source === 'doubao',
    );
    const confirmMessage = await page.evaluate(() => window.__lastConfirmMessage);
    assert.match(confirmMessage, /按已保存默认范围撤回 豆包 来源写入「个人」范围/);
    assert.match(confirmMessage, /这是删除 Memory Service 记忆的操作/);
    assert.match(confirmMessage, /不会删除原始聊天/);
    const revokePayload = await page.evaluate(() => window.__lastRevokeMemory);
    assert.deepEqual(revokePayload, {
      source: 'doubao',
      scope: 'personal',
    });
    await expectText(page, '#doubao-source-message', /撤回请求回执/);
    await expectText(
      page,
      '#doubao-source-message',
      /正在等待 Memory Service 删除和本地 Explorer 审计标记返回/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /当前还不能证明消息、chunk 或 artifact 已撤回/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /预览、缓存、cursor 和 豆包 原始对话也尚未刷新或删除/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /本地当前约 8 条 artifact 等待标记/,
    );
    await expectText(
      page,
      '#doubao-source-message',
      /2 条旧版无 scope 审计会在确认后按本次范围补标记/,
    );
    assert.equal(
      await page.locator('#doubao-source-message').evaluate((element) =>
        element.classList.contains('status-blocked'),
      ),
      true,
    );
    await page.evaluate(() => window.__releaseRevokeMemory?.());
    await expectText(page, '#doubao-source-message', /Memory Service 删除 0 条消息、0 个记忆块/);
    await expectText(page, '#doubao-source-message', /本地 artifact 8 -> 0/);
    await expectText(page, '#doubao-source-message', /本轮标记 8 条/);
    await expectText(page, '#doubao-source-message', /旧审计 2 条/);
    await expectText(page, '#doubao-source-message', /本地审计已撤回/);
    await expectText(page, '#doubao-source-message', /预览仍会保留这些审计行/);
    assert.equal(
      await page.locator('#doubao-source-message').evaluate((element) =>
        element.classList.contains('status-blocked'),
      ),
      true,
    );

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

async function expectNoText(page, selector, pattern) {
  const text = await page.locator(selector).textContent();
  assert.doesNotMatch(text || '', pattern);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
