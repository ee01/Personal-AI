import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { BrowserConversationSnapshot } from '../browserSession.js';
import { loadConfig } from '../config.js';
import { CursorStore, RawMessageStore } from '../explorer/index.js';
import {
  buildDoubaoRawMessages,
  DoubaoChatSource,
  parseDoubaoTimeLabel,
  type DoubaoConversationCollectorClient,
} from '../explorer/sources/DoubaoChatSource.js';
import { BridgeMemoryServiceClient } from '../memoryServiceClient.js';
import { BridgeSettingsStore } from '../settings.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
): string {
  return new Date(year, monthIndex, day, hours, minutes, 0, 0).toISOString();
}

class FakeDoubaoCollectorClient implements DoubaoConversationCollectorClient {
  public readonly openedUrls: string[] = [];
  public collectCalls = 0;

  constructor(
    private readonly authStatus: 'connected' | 'needs_login',
    private readonly snapshots: BrowserConversationSnapshot[],
  ) {}

  async openLogin(): Promise<string> {
    const url = 'https://www.doubao.com/';
    this.openedUrls.push(url);
    return url;
  }

  async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
    return this.authStatus;
  }

  async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
    this.collectCalls += 1;
    return this.snapshots;
  }
}

test('parseDoubaoTimeLabel handles relative and localized labels', () => {
  const now = new Date('2026-04-17T12:00:00.000Z');

  assert.equal(parseDoubaoTimeLabel('刚刚', now), '2026-04-17T12:00:00.000Z');
  assert.equal(
    parseDoubaoTimeLabel('3分钟前', now),
    '2026-04-17T11:57:00.000Z',
  );
  assert.equal(
    parseDoubaoTimeLabel('昨天 08:30', now),
    localIso(2026, 3, 16, 8, 30),
  );
  assert.equal(
    parseDoubaoTimeLabel('2026年4月10日 09:15', now),
    localIso(2026, 3, 10, 9, 15),
  );
});

test('buildDoubaoRawMessages normalizes content, roles, and synthetic ids', () => {
  const now = new Date('2026-04-17T12:00:00.000Z');
  const messages = buildDoubaoRawMessages(
    {
      conversationId: 'conv-1',
      url: 'https://www.doubao.com/chat/conv-1',
      updatedLabel: '昨天 08:30',
      messages: [
        {
          roleHint: 'Doubao Assistant',
          content: '  hello\n\nworld  ',
        },
        {
          messageId: 'msg-2',
          roleHint: '我',
          content: 'follow up',
          timestampLabel: '2026年4月17日 09:15',
        },
      ],
    },
    now,
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'assistant');
  assert.equal(messages[0]?.content, 'hello world');
  assert.equal(messages[0]?.ts, localIso(2026, 3, 16, 8, 30));
  assert.ok(messages[0]?.messageId);
  assert.notEqual(messages[0]?.messageId, 'msg-2');
  assert.equal(messages[1]?.role, 'user');
  assert.equal(messages[1]?.messageId, 'msg-2');
  assert.equal(messages[1]?.ts, localIso(2026, 3, 17, 9, 15));
});

test('DoubaoChatSource collects cached history and extracts pending chat', async () => {
  const tempDir = await createTempDir('desktop-app-doubao-source-');
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
      doubao: {
        ...settingsStore.get().explorer.doubao,
        enabled: true,
        lookbackDays: 7,
        defaultScope: 'personal',
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
  const collector = new FakeDoubaoCollectorClient('connected', [
    {
      conversationId: 'conv-recent',
      url: 'https://www.doubao.com/chat/conv-recent',
      title: 'Recent chat',
      updatedLabel: '2小时前',
      messages: [
        {
          messageId: 'msg-1',
          roleHint: '我',
          content: 'hello from doubao',
          timestampLabel: '2026年4月17日 09:10',
        },
        {
          messageId: 'msg-2',
          roleHint: 'Doubao',
          content: 'assistant answer',
          timestampLabel: '2026年4月17日 09:11',
        },
        {
          roleHint: '我',
          content: '  second question  ',
          timestampLabel: '2026年4月17日 09:12',
        },
      ],
    },
    {
      conversationId: 'conv-old',
      url: 'https://www.doubao.com/chat/conv-old',
      title: 'Old chat',
      updatedLabel: '30天前',
      messages: [
        {
          messageId: 'old-1',
          roleHint: '我',
          content: 'should be skipped by lookback',
        },
      ],
    },
  ]);

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
            kind: 'plan',
            text: 'Follow up on the second question',
            source_quote: 'second question',
            conversation_ref: 'conv-recent',
          },
        ],
        ingestResults: [],
        scopeUsed: 'personal',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const source = new DoubaoChatSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      collector,
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
    assert.equal(collector.collectCalls, 1);
    assert.deepEqual(rawStore.getStats('doubao'), {
      messageCount: 3,
      pendingExtractCount: 0,
      conversationCount: 1,
      artifactCount: 1,
    });

    const previewMessages = rawStore
      .listMessages({
        source: 'doubao',
        conversationId: 'conv-recent',
        limit: 10,
      })
      .map((message) => ({
        messageId: message.messageId,
        role: message.role,
        content: message.content,
      }));
    assert.equal(previewMessages.length, 3);
    assert.deepEqual(
      previewMessages.map((message) => message.role),
      ['user', 'assistant', 'user'],
    );

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0]?.url,
      'http://127.0.0.1:3210/api/v1/extractor/from-chat',
    );
    assert.deepEqual(fetchCalls[0]?.body, {
      source: 'doubao_chat',
      scope: 'personal',
      autoClassify: true,
      segments: [
        {
          id: previewMessages[2]?.messageId,
          speaker: 'user',
          timestamp: Math.floor(
            Date.parse(localIso(2026, 3, 17, 9, 10)) / 1000,
          ),
          text: 'hello from doubao',
        },
        {
          id: previewMessages[1]?.messageId,
          speaker: 'assistant',
          timestamp: Math.floor(
            Date.parse(localIso(2026, 3, 17, 9, 11)) / 1000,
          ),
          text: 'assistant answer',
        },
        {
          id: previewMessages[0]?.messageId,
          speaker: 'user',
          timestamp: Math.floor(
            Date.parse(localIso(2026, 3, 17, 9, 12)) / 1000,
          ),
          text: 'second question',
        },
      ],
    });

    const artifacts = rawStore.listConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-recent',
    });
    assert.equal(artifacts.length, 1);
    assert.deepEqual(
      {
        ...artifacts[0],
        extractedAt: undefined,
      },
      {
        source: 'doubao',
        conversationId: 'conv-recent',
        extractedAt: undefined,
        kind: 'plan',
        text: 'Follow up on the second question',
        sourceQuote: 'second question',
        conversationRef: 'conv-recent',
      },
    );

    const cursor = await cursorStore.get('doubao', 'conv-recent');
    assert.equal(cursor?.source, 'doubao');
    assert.equal(cursor?.conversationId, 'conv-recent');
    assert.equal(cursor?.lastMessageId, previewMessages[0]!.messageId);
    assert.equal(
      cursor?.contentHash,
      rawStore.listMessages({
        source: 'doubao',
        conversationId: 'conv-recent',
        limit: 1,
      })[0]!.contentHash,
    );
    assert.ok(cursor?.lastProcessedUpdateTime);

    const secondResult = await source.runNow();
    assert.deepEqual(secondResult, {
      insertedCount: 0,
      extractedConversationCount: 0,
      extractedMessageCount: 0,
      artifactCount: 0,
      skippedConversationCount: 0,
      implemented: true,
    });
    assert.equal(collector.collectCalls, 2);
    assert.equal(fetchCalls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});

test('DoubaoChatSource reports needs_login when no Doubao session exists', async () => {
  const tempDir = await createTempDir('desktop-app-doubao-auth-');
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
  const source = new DoubaoChatSource(
    settingsStore,
    rawStore,
    cursorStore,
    memoryClient,
    new FakeDoubaoCollectorClient('needs_login', []),
  );

  try {
    assert.equal(await source.getAuthStatus(), 'needs_login');
    await assert.rejects(
      () => source.runNow(),
      /Doubao login required before running explorer collection/,
    );
  } finally {
    rawStore.close();
  }
});

test('DoubaoChatSource skips conversations that still look in progress', async () => {
  const tempDir = await createTempDir('desktop-app-doubao-in-progress-');
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
      doubao: {
        ...settingsStore.get().explorer.doubao,
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
  const collector = new FakeDoubaoCollectorClient('connected', [
    {
      conversationId: 'conv-active-user-tail',
      url: 'https://www.doubao.com/chat/conv-active-user-tail',
      title: 'Still waiting',
      updatedLabel: '1分钟前',
      messages: [
        {
          messageId: 'user-1',
          roleHint: '我',
          content: 'pending answer',
          timestampLabel: '今天 09:10',
        },
      ],
    },
    {
      conversationId: 'conv-just-now',
      url: 'https://www.doubao.com/chat/conv-just-now',
      title: 'Streaming maybe',
      updatedLabel: '刚刚',
      messages: [
        {
          messageId: 'user-2',
          roleHint: '我',
          content: 'hello',
          timestampLabel: '今天 09:10',
        },
        {
          messageId: 'assistant-2',
          roleHint: 'Doubao',
          content: 'partial answer',
          timestampLabel: '今天 09:11',
        },
      ],
    },
  ]);

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
    const source = new DoubaoChatSource(
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient,
      collector,
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
    assert.equal(rawStore.getStats('doubao').messageCount, 0);
    assert.equal(
      await cursorStore.get('doubao', 'conv-active-user-tail'),
      undefined,
    );
    assert.equal(await cursorStore.get('doubao', 'conv-just-now'), undefined);
  } finally {
    globalThis.fetch = originalFetch;
    rawStore.close();
  }
});
