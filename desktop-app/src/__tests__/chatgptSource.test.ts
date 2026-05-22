import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadConfig } from '../config.js';
import { CursorStore, RawMessageStore } from '../explorer/index.js';
import type { ChatGPTApiClient } from '../explorer/sources/ChatGPTSource.js';
import { ChatGPTSource } from '../explorer/sources/ChatGPTSource.js';
import { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import { BridgeSettingsStore } from '../settings.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

class FakeChatGPTClient implements ChatGPTApiClient {
  public readonly openedUrls: string[] = [];
  public readonly requestedConversationIds: string[] = [];
  public readonly requestedPages: Array<{ offset: number; limit: number }> = [];

  constructor(
    private accessToken: string | undefined,
    private readonly pages: Array<
      Array<{
        id: string;
        update_time?: number;
      }>
    >,
    private readonly conversations: Record<string, unknown>,
    private readonly options?: { allowCookieAuth?: boolean },
  ) {}

  async openLogin(): Promise<string> {
    const url = 'https://chatgpt.com/auth/login';
    this.openedUrls.push(url);
    return url;
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.accessToken;
  }

  async listConversationsPage(
    accessToken: string | undefined,
    offset: number,
    limit: number,
  ): Promise<Array<{ id: string; update_time?: number }>> {
    if (!this.options?.allowCookieAuth) {
      assert.equal(accessToken, this.accessToken);
    }
    if (!this.accessToken && !this.options?.allowCookieAuth) {
      throw new Error('ChatGPT GET /backend-api/conversations failed: 401');
    }
    this.requestedPages.push({ offset, limit });
    return this.pages[Math.floor(offset / limit)] ?? [];
  }

  async getConversation(
    accessToken: string | undefined,
    conversationId: string,
  ): Promise<Record<string, unknown>> {
    if (!this.options?.allowCookieAuth) {
      assert.equal(accessToken, this.accessToken);
    }
    this.requestedConversationIds.push(conversationId);
    return (this.conversations[conversationId] ?? {}) as Record<
      string,
      unknown
    >;
  }

  async close(): Promise<void> {}
}

test('ChatGPTSource collects current-node messages, stores raw cache, and extracts pending chat', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-source-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  await settingsStore.update({
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
    explorer: {
      ...settingsStore.get().explorer,
      autoClassify: true,
      chatgpt: {
        ...settingsStore.get().explorer.chatgpt,
        enabled: true,
        maxConversations: 5,
        lookbackDays: 30,
        defaultScope: 'work',
      },
    },
  });

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const nowSeconds = Math.floor(Date.now() / 1000);
  const chatgptClient = new FakeChatGPTClient(
    'chatgpt-token',
    [[{ id: 'conv-1', update_time: nowSeconds }], []],
    {
      'conv-1': {
        current_node: 'node-3',
        mapping: {
          'node-1': {
            id: 'node-1',
            parent: null,
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              create_time: 1_710_000_100,
              content: { parts: ['first user message'] },
            },
          },
          'node-2': {
            id: 'node-2',
            parent: 'node-1',
            message: {
              id: 'msg-2',
              author: { role: 'assistant' },
              create_time: 1_710_000_200,
              content: { text: 'assistant reply' },
            },
          },
          'node-3': {
            id: 'node-3',
            parent: 'node-2',
            message: {
              id: 'msg-3',
              author: { role: 'user' },
              create_time: 1_710_000_300,
              content: {
                list: [{ text: 'follow-up question' }, 'with extra detail'],
              },
            },
          },
          'node-side': {
            id: 'node-side',
            parent: 'node-1',
            message: {
              id: 'msg-side',
              author: { role: 'assistant' },
              create_time: 1_710_000_150,
              content: { text: 'side branch response' },
            },
          },
        },
      },
    },
  );

  const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    fetchCalls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        artifacts: [
          {
            kind: 'fact',
            text: 'User asked a follow-up question',
            source_quote: 'follow-up question',
            conversation_ref: 'conv-1',
          },
        ],
        ingestResults: [],
        scopeUsed: 'work',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const source = new ChatGPTSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      chatgptClient,
    );

    assert.equal(await source.getAuthStatus(), 'connected');
    const openLoginResult = await source.openLogin();
    assert.equal(openLoginResult.opened, true);

    const result = await source.runNow();
    assert.deepEqual(result, {
      insertedCount: 3,
      extractedConversationCount: 1,
      extractedMessageCount: 3,
      artifactCount: 1,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.deepEqual(chatgptClient.requestedPages, [
      { offset: 0, limit: 100 },
      { offset: 100, limit: 100 },
    ]);
    assert.deepEqual(chatgptClient.requestedConversationIds, ['conv-1']);
    assert.deepEqual(rawStore.getStats('chatgpt'), {
      messageCount: 3,
      pendingExtractCount: 0,
      conversationCount: 1,
    });

    const storedMessages = rawStore
      .listPendingMessages({ source: 'chatgpt' })
      .map((message) => message.messageId);
    assert.deepEqual(storedMessages, []);

    const previewMessages = rawStore
      .listMessages({ source: 'chatgpt', conversationId: 'conv-1', limit: 10 })
      .map((message) => ({
        messageId: message.messageId,
        role: message.role,
        content: message.content,
      }));
    assert.deepEqual(previewMessages, [
      {
        messageId: 'msg-3',
        role: 'user',
        content: 'follow-up question\nwith extra detail',
      },
      {
        messageId: 'msg-2',
        role: 'assistant',
        content: 'assistant reply',
      },
      {
        messageId: 'msg-1',
        role: 'user',
        content: 'first user message',
      },
    ]);

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0]?.url,
      'http://127.0.0.1:3210/api/v1/extractor/from-chat',
    );
    assert.deepEqual(fetchCalls[0]?.body, {
      source: 'chatgpt',
      scope: 'work',
      autoClassify: true,
      segments: [
        {
          id: 'msg-1',
          speaker: 'user',
          timestamp: 1_710_000_100,
          text: 'first user message',
        },
        {
          id: 'msg-2',
          speaker: 'assistant',
          timestamp: 1_710_000_200,
          text: 'assistant reply',
        },
        {
          id: 'msg-3',
          speaker: 'user',
          timestamp: 1_710_000_300,
          text: 'follow-up question\nwith extra detail',
        },
      ],
    });

    const artifacts = rawStore.listConversationArtifacts({
      source: 'chatgpt',
      conversationId: 'conv-1',
    });
    assert.deepEqual(artifacts, [
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        extractedAt: artifacts[0]!.extractedAt,
        kind: 'fact',
        text: 'User asked a follow-up question',
        sourceQuote: 'follow-up question',
        conversationRef: 'conv-1',
      },
    ]);

    assert.deepEqual(await cursorStore.get('chatgpt', 'conv-1'), {
      source: 'chatgpt',
      conversationId: 'conv-1',
      lastMessageId: 'msg-3',
      lastProcessedUpdateTime: new Date(nowSeconds * 1000).toISOString(),
      contentHash: rawStore.listMessages({
        source: 'chatgpt',
        conversationId: 'conv-1',
        limit: 1,
      })[0]!.contentHash,
      processedMessageIds: ['msg-1', 'msg-2', 'msg-3'],
    });

    const secondResult = await source.runNow();
    assert.deepEqual(secondResult, {
      insertedCount: 0,
      extractedConversationCount: 0,
      extractedMessageCount: 0,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.deepEqual(chatgptClient.requestedConversationIds, ['conv-1']);
    assert.equal(fetchCalls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});

test('ChatGPTSource uses processed message ids to avoid reprocessing unchanged settled chains', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-processed-cursor-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  await settingsStore.update({
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
    explorer: {
      ...settingsStore.get().explorer,
      autoClassify: true,
      chatgpt: {
        ...settingsStore.get().explorer.chatgpt,
        enabled: true,
        maxConversations: 5,
        lookbackDays: 30,
        defaultScope: 'work',
      },
    },
  });

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const nowSeconds = Math.floor(Date.now() / 1000);
  const chatgptClient = new FakeChatGPTClient(
    'chatgpt-token',
    [
      [{ id: 'conv-1', update_time: nowSeconds }],
      [],
      [{ id: 'conv-1', update_time: nowSeconds + 30 }],
      [],
    ],
    {
      'conv-1': {
        current_node: 'node-2',
        mapping: {
          'node-1': {
            id: 'node-1',
            parent: null,
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              create_time: 1_710_000_100,
              content: { parts: ['question'] },
            },
          },
          'node-2': {
            id: 'node-2',
            parent: 'node-1',
            message: {
              id: 'msg-2',
              author: { role: 'assistant' },
              create_time: 1_710_000_200,
              content: { text: 'answer' },
            },
          },
        },
      },
    },
  );

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({ artifacts: [], ingestResults: [], scopeUsed: 'work' }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const source = new ChatGPTSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      chatgptClient,
    );

    assert.deepEqual(await source.runNow(), {
      insertedCount: 2,
      extractedConversationCount: 1,
      extractedMessageCount: 2,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.equal(fetchCalls, 1);

    (
      chatgptClient as unknown as {
        pages: Array<Array<{ id: string; update_time?: number }>>;
      }
    ).pages = [[{ id: 'conv-1', update_time: nowSeconds + 30 }], []];

    assert.deepEqual(await source.runNow(), {
      insertedCount: 0,
      extractedConversationCount: 0,
      extractedMessageCount: 0,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.equal(fetchCalls, 1);
    assert.deepEqual(chatgptClient.requestedConversationIds, [
      'conv-1',
      'conv-1',
    ]);

    const cursor = await cursorStore.get('chatgpt', 'conv-1');
    assert.equal(
      cursor?.lastProcessedUpdateTime,
      new Date((nowSeconds + 30) * 1000).toISOString(),
    );
    assert.deepEqual(cursor?.processedMessageIds, ['msg-1', 'msg-2']);
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});

test('ChatGPTSource skips conversations that still end with the user turn', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-in-progress-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  await settingsStore.update({
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
    explorer: {
      ...settingsStore.get().explorer,
      autoClassify: true,
      chatgpt: {
        ...settingsStore.get().explorer.chatgpt,
        enabled: true,
      },
    },
  });

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const nowSeconds = Math.floor(Date.now() / 1000);
  const chatgptClient = new FakeChatGPTClient(
    'chatgpt-token',
    [[{ id: 'conv-1', update_time: nowSeconds }], []],
    {
      'conv-1': {
        current_node: 'node-1',
        mapping: {
          'node-1': {
            id: 'node-1',
            parent: null,
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              create_time: 1_710_000_100,
              content: { parts: ['still waiting for answer'] },
            },
          },
        },
      },
    },
  );

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ artifacts: [], ingestResults: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const source = new ChatGPTSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      chatgptClient,
    );

    assert.deepEqual(await source.runNow(), {
      insertedCount: 0,
      extractedConversationCount: 0,
      extractedMessageCount: 0,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.equal(fetchCalls, 0);
    assert.equal(rawStore.getStats('chatgpt').messageCount, 0);
    assert.equal(await cursorStore.get('chatgpt', 'conv-1'), undefined);
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});

test('ChatGPTSource reports needs_login when no ChatGPT session exists', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-auth-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => ({
    ...settingsStore.get(),
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
  }));
  const source = new ChatGPTSource(
    settingsStore,
    rawStore,
    cursorStore,
    memoryClient,
    new FakeChatGPTClient(undefined, [], {}),
  );

  try {
    assert.equal(await source.getAuthStatus(), 'needs_login');
    await assert.rejects(
      () => source.runNow(),
      /ChatGPT login required before running explorer collection/,
    );
  } finally {
    rawStore.close();
  }
});

test('ChatGPTSource reports error when ChatGPT session probe throws', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-auth-error-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => ({
    ...settingsStore.get(),
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
  }));
  const source = new ChatGPTSource(
    settingsStore,
    rawStore,
    cursorStore,
    memoryClient,
    {
      async openLogin(): Promise<string> {
        return 'https://chatgpt.com/auth/login';
      },
      async getAccessToken(): Promise<string | undefined> {
        throw new Error('No existing chatgpt.com tab found in Chrome');
      },
      async listConversationsPage(): Promise<Array<{ id: string }>> {
        return [];
      },
      async getConversation(): Promise<Record<string, unknown>> {
        return {};
      },
      async close(): Promise<void> {},
    },
  );

  try {
    assert.equal(await source.getAuthStatus(), 'error');
  } finally {
    rawStore.close();
  }
});

test('ChatGPTSource treats cookie-authenticated ChatGPT as connected without access token', async () => {
  const tempDir = await createTempDir('desktop-app-chatgpt-cookie-auth-');
  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
    DOUBAO_BRIDGE_HEADLESS: 'true',
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  await settingsStore.update({
    memoryServiceBaseUrl: 'http://127.0.0.1:3210',
    memoryServiceUserId: 'tester',
    explorer: {
      ...settingsStore.get().explorer,
      autoClassify: true,
      chatgpt: {
        ...settingsStore.get().explorer.chatgpt,
        enabled: true,
        maxConversations: 5,
        lookbackDays: 30,
        defaultScope: 'work',
      },
    },
  });

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const memoryClient = new BridgeMemoryServiceClient(() => settingsStore.get());
  const nowSeconds = Math.floor(Date.now() / 1000);
  const chatgptClient = new FakeChatGPTClient(
    undefined,
    [[{ id: 'conv-cookie', update_time: nowSeconds }], []],
    {
      'conv-cookie': {
        current_node: 'node-2',
        mapping: {
          'node-1': {
            id: 'node-1',
            parent: null,
            message: {
              id: 'msg-1',
              author: { role: 'user' },
              create_time: nowSeconds - 60,
              content: { parts: ['cookie auth user message'] },
            },
          },
          'node-2': {
            id: 'node-2',
            parent: 'node-1',
            message: {
              id: 'msg-2',
              author: { role: 'assistant' },
              create_time: nowSeconds - 30,
              end_turn: true,
              content: { parts: ['cookie auth assistant reply'] },
            },
          },
        },
      },
    },
    { allowCookieAuth: true },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        artifacts: [],
        ingestResults: [],
        scopeUsed: 'work',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch;

  try {
    const source = new ChatGPTSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      chatgptClient,
    );

    assert.equal(await source.getAuthStatus(), 'connected');
    const result = await source.runNow();
    assert.deepEqual(result, {
      insertedCount: 2,
      extractedConversationCount: 1,
      extractedMessageCount: 2,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});
