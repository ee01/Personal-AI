import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { ExplorerExtractor } from '../explorer/extractor.js';
import { RawMessageStore } from '../explorer/index.js';
import { BridgeMemoryServiceHttpError } from '../memoryServiceClient.js';

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
