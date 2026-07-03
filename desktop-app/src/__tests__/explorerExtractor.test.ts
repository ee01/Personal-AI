import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ExplorerExtractor } from '../explorer/extractor.js';
import { CursorStore, RawMessageStore } from '../explorer/index.js';
import { LocalAgentSessionSource } from '../explorer/sources/LocalAgentSessionSource.js';
import {
  BridgeMemoryServiceHttpError,
  type ExtractFromChatResponse,
} from '../memoryServiceClient.js';
import { loadConfig } from '../config.js';
import { BridgeSettingsStore } from '../settings.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('ExplorerExtractor marks no-meaningful-segment conversations as extracted', async () => {
  const tempDir = await createTempDir('desktop-app-explorer-extractor-');
  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );

  rawStore.insertMany([
    {
      source: 'chatgpt',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      ts: '2026-04-17T10:00:00.000Z',
      role: 'user',
      contentHash: 'hash-1',
      content: '   ',
    },
  ]);

  const memoryClient = {
    extractFromChat: async () => {
      throw new BridgeMemoryServiceHttpError(
        'No meaningful chat segments remained after cleaning.',
        400,
        { message: 'No meaningful chat segments remained after cleaning.' },
      );
    },
  };

  try {
    const extractor = new ExplorerExtractor(memoryClient, rawStore);
    const result = await extractor.extractPendingMessages({
      source: 'chatgpt',
      defaultScope: 'work',
      autoClassify: false,
    });

    assert.deepEqual(result, {
      conversationCount: 1,
      messageCount: 1,
      artifactCount: 0,
      skippedConversationCount: 1,
    });
    assert.equal(rawStore.getStats('chatgpt').pendingExtractCount, 0);
  } finally {
    rawStore.close();
  }
});

test('LocalAgentSessionSource imports JSONL sessions and extracts as agent session', async () => {
  const tempDir = await createTempDir('desktop-app-local-agent-source-');
  const sessionsDir = path.join(tempDir, 'sessions');
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionsDir, 'session-1.jsonl'),
    [
      JSON.stringify({
        timestamp: '2026-05-26T10:00:00.000Z',
        role: 'user',
        message: 'Please fix the Composer Guard repo bug.',
      }),
      JSON.stringify({
        timestamp: '2026-05-26T10:05:00.000Z',
        role: 'assistant',
        message:
          'Changed ContextAssistService and ran tests.\n```ts\nconst noisy = true;\n```',
      }),
    ].join('\n'),
    'utf8',
  );

  const config = loadConfig({
    DOUBAO_BRIDGE_DATA_DIR: tempDir,
    DOUBAO_BRIDGE_PROFILE_DIR: path.join(tempDir, 'profile'),
  });
  const settingsStore = new BridgeSettingsStore(
    config,
    path.join(tempDir, 'bridge-settings.json'),
  );
  await settingsStore.init();
  await settingsStore.update({
    explorer: {
      codex_cli: {
        ...settingsStore.get().explorer.codex_cli,
        enabled: true,
        rootPaths: [sessionsDir],
        maxSessions: 10,
        lookbackDays: 0,
      },
    },
  });

  const rawStore = new RawMessageStore(
    path.join(tempDir, 'explorer', 'raw-messages.sqlite'),
  );
  const cursorStore = new CursorStore(
    path.join(tempDir, 'explorer', 'cursors.json'),
  );
  const extractCalls: any[] = [];
  const memoryClient = {
    extractFromChat: async (input: any) => {
      extractCalls.push(input);
      return {
        artifacts: [
          {
            kind: 'result',
            text: 'Codex updated ContextAssistService and ran tests.',
            source_quote: 'Changed ContextAssistService and ran tests.',
            conversation_ref: input.segments[1].id,
          },
        ],
        ingestResults: [],
        scopeUsed: 'work',
      };
    },
  };

  try {
    const source = new LocalAgentSessionSource({
      source: 'codex_cli',
      settingsStore,
      rawStore,
      cursorStore,
      memoryClient: memoryClient as any,
    });
    const result = await source.runNow();

    assert.equal(result.implemented, true);
    assert.equal(result.insertedCount, 2);
    assert.equal(result.extractedConversationCount, 1);
    assert.equal(rawStore.getStats('codex_cli').messageCount, 2);
    assert.equal(rawStore.getStats('codex_cli').artifactCount, 1);
    assert.equal(extractCalls[0].source, 'codex_cli');
    assert.equal(extractCalls[0].sourceType, 'codex_cli');
    assert.equal(extractCalls[0].extractMode, 'agent_session');
    assert.equal(extractCalls[0].conversationMeta.toolKey, 'codex_cli');
    assert.match(extractCalls[0].segments[1].text, /code omitted/);
    assert.doesNotMatch(extractCalls[0].segments[1].text, /const noisy/);
  } finally {
    rawStore.close();
  }
});

test('ExplorerExtractor appends incremental artifacts instead of replacing conversation audit', async () => {
  const tempDir = await createTempDir('explorer-extractor-incremental-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));
  const responses: ExtractFromChatResponse[] = [
    {
      artifacts: [
        {
          kind: 'fact',
          text: 'first batch artifact',
          source_quote: 'first message',
          conversation_ref: 'conv-1',
        },
      ],
      ingestResults: [],
      scopeUsed: 'work',
    },
    {
      artifacts: [
        {
          kind: 'plan',
          text: 'second batch artifact',
          source_quote: 'second message',
          conversation_ref: 'conv-1',
        },
      ],
      ingestResults: [],
      scopeUsed: 'work',
    },
  ];
  const extractor = new ExplorerExtractor(
    {
      extractFromChat: async () => responses.shift()!,
    },
    store,
  );

  try {
    store.insertMany([
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        ts: '2026-04-17T10:00:00.000Z',
        role: 'user',
        contentHash: 'hash-1',
        content: 'first message',
      },
    ]);

    assert.deepEqual(
      await extractor.extractPendingMessages({
        source: 'chatgpt',
        defaultScope: 'work',
        autoClassify: true,
      }),
      {
        conversationCount: 1,
        messageCount: 1,
        artifactCount: 1,
        skippedConversationCount: 0,
      },
    );

    store.insertMany([
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-2',
        ts: '2026-04-17T10:05:00.000Z',
        role: 'assistant',
        contentHash: 'hash-2',
        content: 'second message',
      },
    ]);

    assert.deepEqual(
      await extractor.extractPendingMessages({
        source: 'chatgpt',
        defaultScope: 'work',
        autoClassify: true,
      }),
      {
        conversationCount: 1,
        messageCount: 1,
        artifactCount: 1,
        skippedConversationCount: 0,
      },
    );

    assert.deepEqual(
      store
        .listConversationArtifacts({ source: 'chatgpt', conversationId: 'conv-1' })
        .map((artifact) => ({
          kind: artifact.kind,
          text: artifact.text,
          scope: artifact.scope,
          revokedAt: artifact.revokedAt,
        })),
      [
        {
          kind: 'plan',
          text: 'second batch artifact',
          scope: 'work',
          revokedAt: undefined,
        },
        {
          kind: 'fact',
          text: 'first batch artifact',
          scope: 'work',
          revokedAt: undefined,
        },
      ],
    );
    assert.equal(store.getStats('chatgpt').artifactCount, 2);
  } finally {
    store.close();
  }
});
