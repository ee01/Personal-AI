import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { DoubaoBridgeService } from '../bridgeService.js';
import type {
  BrowserSendResult,
  BrowserThreadSnapshot,
} from '../browserSession.js';
import { loadConfig } from '../config.js';
import {
  CursorStore,
  ExplorerManager,
  RawMessageStore,
} from '../explorer/index.js';
import { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import { StateStore } from '../persistence.js';
import { createBridgeServer } from '../server.js';
import {
  applyBridgeSettingsToConfig,
  BridgeSettingsStore,
} from '../settings.js';
import { BridgeSyncManager } from '../syncManager.js';

class FakeBrowser {
  running = false;
  currentUrl = '';

  async ensureStarted(): Promise<void> {
    this.running = true;
  }

  async openLogin(): Promise<string> {
    await this.ensureStarted();
    this.currentUrl = 'https://www.doubao.com/';
    return this.currentUrl;
  }

  async openThread(url: string): Promise<BrowserThreadSnapshot> {
    await this.ensureStarted();
    this.currentUrl = url;
    return { url, title: 'Opened Thread', threadId: url.split('/').pop() };
  }

  async collectConversationSnapshots() {
    await this.ensureStarted();
    return [];
  }

  async sendTranscript(
    transcript: string,
    threadUrl?: string,
  ): Promise<BrowserSendResult> {
    await this.ensureStarted();
    return {
      url: threadUrl ?? 'https://www.doubao.com/chat/generated-test',
      title: 'Explorer Test Thread',
      threadId: 'generated-test',
      sent: transcript.length > 0,
    };
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.running ? 'connected' : 'needs_login';
  }

  async findThreadByTitle(
    title: string,
  ): Promise<BrowserThreadSnapshot | null> {
    return {
      title,
      url: `https://www.doubao.com/chat/${encodeURIComponent(title)}`,
      threadId: encodeURIComponent(title),
    };
  }

  status() {
    return { running: this.running, currentUrl: this.currentUrl };
  }

  async close(): Promise<void> {}
}

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('explorer endpoints expose cache status and stubbed source actions', async () => {
  const tempDir = await createTempDir('desktop-app-explorer-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());

  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();

  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const syncManager = new BridgeSyncManager(
    config,
    settingsStore,
    memoryClient,
    service,
  );
  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  rawStore.insertMany([
    {
      source: 'doubao',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      ts: '2026-04-17T10:00:00.000Z',
      role: 'user',
      contentHash: 'hash-d-1',
      content: 'from doubao',
    },
    {
      source: 'chatgpt',
      conversationId: 'conv-2',
      messageId: 'msg-2',
      ts: '2026-04-17T10:01:00.000Z',
      role: 'assistant',
      contentHash: 'hash-c-1',
      content: 'from chatgpt',
    },
  ]);
  rawStore.replaceConversationArtifacts({
    source: 'doubao',
    conversationId: 'conv-1',
    scope: 'personal',
    extractedAt: '2026-04-17T10:05:00.000Z',
    artifacts: [
      {
        kind: 'fact',
        text: 'from extracted artifact',
        sourceQuote: 'from doubao',
        conversationRef: 'conv-1',
      },
    ],
  });
  await cursorStore.upsert({
    source: 'doubao',
    conversationId: 'conv-1',
    lastMessageId: 'msg-1',
    lastProcessedUpdateTime: '2026-04-17T10:05:00.000Z',
    contentHash: 'hash-d-1',
  });

  const explorerManager = new ExplorerManager({
    settingsStore,
    memoryClient,
    rawStore,
    cursorStore,
    sourceAdapters: {
      doubao: {
        getAuthStatus: async () => (await service.getStatus()).authStatus,
        openLogin: async () => {
          const result = await service.openLogin();
          return { url: result.url, opened: true, implemented: true };
        },
        runNow: async () => ({
          insertedCount: 2,
          extractedConversationCount: 1,
          extractedMessageCount: 2,
          artifactCount: 1,
          skippedConversationCount: 0,
          implemented: true,
        }),
      },
    },
  });

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    explorerManager,
    version: '3.0.1-test',
  });

  try {
    const pair = await app.inject({
      method: 'POST',
      url: '/pair',
      payload: {},
    });
    const token = (pair.json() as { token: string }).token;

    const statusResponse = await app.inject({
      method: 'GET',
      url: '/explorer/status',
      headers: { 'x-bridge-token': token },
    });
    assert.equal(statusResponse.statusCode, 200);
    const statusBody = statusResponse.json() as {
      askDefaultScope: string;
      sources: {
        doubao: {
          authStatus: string;
          cache: {
            messageCount: number;
            pendingExtractCount: number;
            artifactCount: number;
            revokedArtifactCount: number;
          };
          revokePreview: { activeArtifactCount: number };
          settings: { defaultScope: string };
        };
        chatgpt: {
          authStatus: string;
          cache: {
            messageCount: number;
            pendingExtractCount: number;
            artifactCount: number;
            revokedArtifactCount: number;
          };
          revokePreview: { activeArtifactCount: number };
          settings: { defaultScope: string };
        };
      };
    };
    assert.equal(statusBody.askDefaultScope, 'work');
    assert.equal(statusBody.sources.doubao.authStatus, 'unknown');
    assert.equal(statusBody.sources.doubao.cache.messageCount, 1);
    assert.equal(statusBody.sources.doubao.cache.pendingExtractCount, 1);
    assert.equal(statusBody.sources.doubao.cache.artifactCount, 1);
    assert.equal(statusBody.sources.doubao.cache.revokedArtifactCount, 0);
    assert.equal(statusBody.sources.doubao.revokePreview.activeArtifactCount, 1);
    assert.equal(statusBody.sources.doubao.settings.defaultScope, 'personal');
    assert.equal(statusBody.sources.chatgpt.authStatus, 'unsupported');
    assert.equal(statusBody.sources.chatgpt.cache.pendingExtractCount, 1);
    assert.equal(statusBody.sources.chatgpt.cache.artifactCount, 0);
    assert.equal(statusBody.sources.chatgpt.settings.defaultScope, 'work');

    const openLoginResponse = await app.inject({
      method: 'POST',
      url: '/explorer/auth/open-login',
      headers: { 'x-bridge-token': token },
      payload: { source: 'doubao' },
    });
    assert.equal(openLoginResponse.statusCode, 200);
    assert.equal(
      (openLoginResponse.json() as { opened: boolean }).opened,
      true,
    );

    const runNowResponse = await app.inject({
      method: 'POST',
      url: '/explorer/run-now',
      headers: { 'x-bridge-token': token },
      payload: { source: 'doubao' },
    });
    assert.equal(runNowResponse.statusCode, 200);
    const runNowBody = runNowResponse.json() as {
      source: string;
      startedAt: string;
      finishedAt: string;
      implemented: boolean;
      insertedCount: number;
      extractedConversationCount: number;
      extractedMessageCount: number;
      artifactCount: number;
      skippedConversationCount: number;
    };
    assert.equal(runNowBody.source, 'doubao');
    assert.equal(runNowBody.implemented, true);
    assert.equal(runNowBody.insertedCount, 2);
    assert.equal(runNowBody.extractedConversationCount, 1);
    assert.equal(runNowBody.extractedMessageCount, 2);
    assert.equal(runNowBody.artifactCount, 1);
    assert.equal(runNowBody.skippedConversationCount, 0);
    assert.ok(runNowBody.startedAt);
    assert.ok(runNowBody.finishedAt);

    const previewResponse = await app.inject({
      method: 'GET',
      url: '/explorer/preview?source=doubao&conversationId=conv-1&limit=5',
      headers: { 'x-bridge-token': token },
    });
    assert.equal(previewResponse.statusCode, 200);
    const previewBody = previewResponse.json() as {
      conversations: Array<{
        source: string;
        conversationId: string;
        latestTs?: string;
        messageCount: number;
        pendingMessageCount: number;
        extractedMessageCount: number;
        artifactCount: number;
        revokedArtifactCount: number;
        latestMessagePreview?: string;
      }>;
      messages: Array<{
        source: string;
        conversationId: string;
        messageId: string;
        role: string;
        contentHash: string;
        content: string;
        ts?: string;
      }>;
      cleanedMessages: Array<{ content: string; extracted: boolean }>;
      artifacts: Array<{ text: string; sourceQuote: string }>;
      cursor?: { lastMessageId?: string };
    };
    assert.deepEqual(previewBody.conversations, [
      {
        source: 'doubao',
        conversationId: 'conv-1',
        latestTs: '2026-04-17T10:00:00.000Z',
        messageCount: 1,
        pendingMessageCount: 1,
        extractedMessageCount: 0,
        artifactCount: 1,
        revokedArtifactCount: 0,
        latestMessagePreview: 'from doubao',
      },
    ]);
    assert.deepEqual(previewBody.messages, [
      {
        source: 'doubao',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        role: 'user',
        contentHash: 'hash-d-1',
        content: 'from doubao',
        ts: '2026-04-17T10:00:00.000Z',
      },
    ]);
    assert.deepEqual(previewBody.cleanedMessages, [
      {
        source: 'doubao',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        role: 'user',
        ts: '2026-04-17T10:00:00.000Z',
        content: 'from doubao',
        extracted: false,
      },
    ]);
    assert.deepEqual(previewBody.artifacts, [
      {
        source: 'doubao',
        conversationId: 'conv-1',
        extractedAt: '2026-04-17T10:05:00.000Z',
        scope: 'personal',
        kind: 'fact',
        text: 'from extracted artifact',
        sourceQuote: 'from doubao',
        conversationRef: 'conv-1',
      },
    ]);
    assert.equal(previewBody.cursor?.lastMessageId, 'msg-1');

    const memoriesResponse = await app.inject({
      method: 'GET',
      url: '/explorer/memories?source=doubao&limit=10',
      headers: { 'x-bridge-token': token },
    });
    assert.equal(memoriesResponse.statusCode, 200);
    const memoriesBody = memoriesResponse.json() as {
      items: Array<{
        source: string;
        kind: string;
        text: string;
        sourceQuote: string;
        ingestSource: string;
      }>;
      total: number;
      hasMore: boolean;
    };
    assert.equal(memoriesBody.total, 1);
    assert.equal(memoriesBody.hasMore, false);
    assert.equal(memoriesBody.items.length, 1);
    assert.equal(memoriesBody.items[0]!.source, 'doubao');
    assert.equal(memoriesBody.items[0]!.ingestSource, 'doubao_chat');
    assert.equal(memoriesBody.items[0]!.text, 'from extracted artifact');

    // Search filter exercises the q parameter.
    const searchResponse = await app.inject({
      method: 'GET',
      url: '/explorer/memories?q=extracted',
      headers: { 'x-bridge-token': token },
    });
    assert.equal(searchResponse.statusCode, 200);
    assert.equal(
      (searchResponse.json() as { total: number }).total,
      1,
      'q=extracted should match the seeded artifact',
    );

    const resetResponse = await app.inject({
      method: 'POST',
      url: '/explorer/reset-cache',
      headers: { 'x-bridge-token': token },
      payload: { source: 'doubao', conversationId: 'conv-1' },
    });
    assert.equal(resetResponse.statusCode, 200);
    assert.equal(
      (resetResponse.json() as { deletedMessages: number }).deletedMessages,
      1,
    );

    assert.equal(rawStore.getStats('doubao').messageCount, 0);
  } finally {
    syncManager.stop();
    explorerManager.close();
    await app.close();
  }
});

test('ExplorerManager tick schedules only enabled sources by interval', async () => {
  const settings = {
    explorer: {
      doubao: {
        enabled: true,
        lookbackDays: 7,
        intervalMinutes: 5,
        defaultScope: 'personal' as const,
      },
      chatgpt: {
        enabled: false,
        maxConversations: 0,
        lookbackDays: 0,
        intervalMinutes: 10,
        defaultScope: 'work' as const,
      },
      autoClassify: false,
      askDefaultScope: 'work' as const,
    },
  };
  const calls: string[] = [];
  const manager = new ExplorerManager({
    settingsStore: {
      getSettings: () => settings,
    } as any,
    memoryClient: {
      deleteMemoriesBySourceScope: async () => ({
        source: 'doubao',
        scope: 'work',
        deletedMessages: 0,
        deletedChunks: 0,
      }),
    } as any,
    rawStore: {
      getStats: () => ({
        messageCount: 0,
        pendingExtractCount: 0,
        conversationCount: 0,
        artifactCount: 0,
        revokedArtifactCount: 0,
      }),
      getRevokePreview: (_source: string, scope: 'work' | 'personal') => ({
        scope,
        activeArtifactCount: 0,
        legacyUnscopedArtifactCount: 0,
        revokedArtifactCount: 0,
      }),
      close: () => undefined,
    } as any,
    cursorStore: {
      get: async () => undefined,
      reset: async () => 0,
    } as any,
    sourceAdapters: {
      doubao: {
        runNow: async () => {
          calls.push('doubao');
          return { insertedCount: 1, implemented: true };
        },
      },
      chatgpt: {
        runNow: async () => {
          calls.push('chatgpt');
          return { insertedCount: 1, implemented: true };
        },
      },
    },
  });
  const originalDateNow = Date.now;
  let now = Date.parse('2026-04-17T10:00:00.000Z');
  Date.now = () => now;

  try {
    await manager.tick();
    await manager.tick();
    now += 4 * 60_000;
    await manager.tick();
    settings.explorer.chatgpt.enabled = true;
    await manager.tick();
    now += 60_000;
    await manager.tick();
  } finally {
    Date.now = originalDateNow;
  }

  assert.deepEqual(calls, ['doubao', 'chatgpt', 'doubao']);
});

test('ExplorerManager status does not probe disabled source auth', async () => {
  const settings = {
    explorer: {
      doubao: {
        enabled: false,
        lookbackDays: 7,
        intervalMinutes: 5,
        defaultScope: 'personal' as const,
      },
      chatgpt: {
        enabled: false,
        maxConversations: 0,
        lookbackDays: 0,
        intervalMinutes: 10,
        defaultScope: 'work' as const,
      },
      autoClassify: false,
      askDefaultScope: 'work' as const,
    },
  };
  const authProbeCalls: string[] = [];
  const manager = new ExplorerManager({
    settingsStore: {
      getSettings: () => settings,
    } as any,
    memoryClient: {
      deleteMemoriesBySourceScope: async () => ({
        source: 'doubao',
        scope: 'work',
        deletedMessages: 0,
        deletedChunks: 0,
      }),
    } as any,
    rawStore: {
      getStats: () => ({
        messageCount: 0,
        pendingExtractCount: 0,
        conversationCount: 0,
        artifactCount: 0,
        revokedArtifactCount: 0,
      }),
      getRevokePreview: (_source: string, scope: 'work' | 'personal') => ({
        scope,
        activeArtifactCount: 0,
        legacyUnscopedArtifactCount: 0,
        revokedArtifactCount: 0,
      }),
      close: () => undefined,
    } as any,
    cursorStore: {
      get: async () => undefined,
      reset: async () => 0,
    } as any,
    sourceAdapters: {
      doubao: {
        getAuthStatus: async () => {
          authProbeCalls.push('doubao');
          return 'connected';
        },
      },
      chatgpt: {
        getAuthStatus: async () => {
          authProbeCalls.push('chatgpt');
          return 'connected';
        },
      },
    },
  });

  const disabledStatus = await manager.getStatus();

  assert.deepEqual(authProbeCalls, []);
  assert.equal(disabledStatus.sources.doubao.authStatus, 'unknown');
  assert.equal(disabledStatus.sources.chatgpt.authStatus, 'unknown');

  settings.explorer.chatgpt.enabled = true;
  const enabledStatus = await manager.getStatus();

  assert.deepEqual(authProbeCalls, ['chatgpt']);
  assert.equal(enabledStatus.sources.chatgpt.authStatus, 'connected');
});

test('ExplorerManager status reports Doubao transport fallback', async () => {
  const settings = {
    explorer: {
      doubao: {
        enabled: true,
        lookbackDays: 7,
        intervalMinutes: 5,
        defaultScope: 'personal' as const,
        transport: 'webpage_mcp' as const,
      },
      chatgpt: {
        enabled: false,
        maxConversations: 0,
        lookbackDays: 0,
        intervalMinutes: 10,
        defaultScope: 'work' as const,
      },
      autoClassify: false,
      askDefaultScope: 'work' as const,
    },
  };
  const manager = new ExplorerManager({
    settingsStore: {
      getSettings: () => settings,
    } as any,
    memoryClient: {
      deleteMemoriesBySourceScope: async () => ({
        source: 'doubao',
        scope: 'work',
        deletedMessages: 0,
        deletedChunks: 0,
      }),
    } as any,
    rawStore: {
      getStats: () => ({
        messageCount: 0,
        pendingExtractCount: 0,
        conversationCount: 0,
        artifactCount: 0,
        revokedArtifactCount: 0,
      }),
      getRevokePreview: (_source: string, scope: 'work' | 'personal') => ({
        scope,
        activeArtifactCount: 0,
        legacyUnscopedArtifactCount: 0,
        revokedArtifactCount: 0,
      }),
      close: () => undefined,
    } as any,
    cursorStore: {
      get: async () => undefined,
      reset: async () => 0,
    } as any,
    sourceAdapters: {
      doubao: {
        getAuthStatus: async () => 'connected',
        getTransportStatus: () => ({
          mode: 'playwright',
          fallbackReason: 'No existing doubao.com tab found',
        }),
      },
    },
  });

  const status = await manager.getStatus();

  assert.deepEqual(status.sources.doubao.transport, {
    mode: 'playwright',
    fallbackReason: 'No existing doubao.com tab found',
  });
});

test('explorer revoke endpoint proxies memory deletion by source and scope', async () => {
  const tempDir = await createTempDir('desktop-app-explorer-revoke-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });

  const store = new StateStore(path.join(tempDir, 'bridge-state.json'));
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  applyBridgeSettingsToConfig(config, settingsStore.get());

  const browser = new FakeBrowser();
  const service = new DoubaoBridgeService(config, store, browser);
  await service.init();

  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const deleteCalls: Array<{ source: string; scope: string }> = [];
  memoryClient.deleteMemoriesBySourceScope = async (source, scope) => {
    deleteCalls.push({ source, scope });
    return {
      source,
      scope,
      deletedMessages: 2,
      deletedChunks: 5,
    };
  };
  const syncManager = new BridgeSyncManager(
    config,
    settingsStore,
    memoryClient,
    service,
  );
  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  rawStore.replaceConversationArtifacts({
    source: 'chatgpt',
    conversationId: 'conv-personal',
    scope: 'personal',
    artifacts: [
      {
        kind: 'fact',
        text: 'personal chatgpt artifact',
        sourceQuote: 'remember this',
        conversationRef: 'conv-personal',
      },
    ],
  });
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const explorerManager = new ExplorerManager({
    settingsStore,
    memoryClient,
    rawStore,
    cursorStore,
  });

  const app = await createBridgeServer(config, service, {
    memoryClient,
    settingsStore,
    syncManager,
    explorerManager,
    version: '3.0.1-test',
  });

  try {
    const pair = await app.inject({
      method: 'POST',
      url: '/pair',
      payload: {},
    });
    const token = (pair.json() as { token: string }).token;

    const response = await app.inject({
      method: 'POST',
      url: '/explorer/revoke-ingested-memory',
      headers: { 'x-bridge-token': token },
      payload: { source: 'chatgpt', scope: 'personal' },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      source: 'chatgpt',
      scope: 'personal',
      deletedMessages: 2,
      deletedChunks: 5,
      localArtifactsRevoked: 1,
      localLegacyArtifactsRevoked: 0,
    });
    assert.equal(rawStore.getStats('chatgpt').artifactCount, 0);
    assert.equal(rawStore.getStats('chatgpt').revokedArtifactCount, 1);
    assert.deepEqual(deleteCalls, [{ source: 'chatgpt', scope: 'personal' }]);
  } finally {
    syncManager.stop();
    explorerManager.close();
    await app.close();
  }
});
