import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CursorStore } from '../explorer/index.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('CursorStore persists cursors per source and conversation', async () => {
  const tempDir = await createTempDir('explorer-cursor-store-');
  const filePath = path.join(tempDir, 'explorer', 'cursors.json');
  const store = new CursorStore(filePath);

  await store.upsert({
    source: 'doubao',
    conversationId: 'conv-1',
    lastMessageId: 'msg-1',
    lastProcessedUpdateTime: '2026-04-17T10:00:00.000Z',
    contentHash: 'hash-1',
  });
  await store.upsert({
    source: 'chatgpt',
    conversationId: 'conv-2',
    lastMessageId: 'msg-2',
    lastProcessedUpdateTime: '2026-04-17T10:01:00.000Z',
    contentHash: 'hash-2',
    processedMessageIds: ['msg-1', 'msg-2', 'msg-2'],
  });

  const reloaded = new CursorStore(filePath);
  assert.deepEqual(await reloaded.get('doubao', 'conv-1'), {
    source: 'doubao',
    conversationId: 'conv-1',
    lastMessageId: 'msg-1',
    lastProcessedUpdateTime: '2026-04-17T10:00:00.000Z',
    contentHash: 'hash-1',
  });
  assert.deepEqual(await reloaded.get('chatgpt', 'conv-2'), {
    source: 'chatgpt',
    conversationId: 'conv-2',
    lastMessageId: 'msg-2',
    lastProcessedUpdateTime: '2026-04-17T10:01:00.000Z',
    contentHash: 'hash-2',
    processedMessageIds: ['msg-1', 'msg-2'],
  });
  assert.equal((await reloaded.list()).length, 2);

  assert.equal(await reloaded.reset('doubao', 'conv-1'), 1);
  assert.equal(await reloaded.get('doubao', 'conv-1'), undefined);
  assert.equal((await reloaded.list()).length, 1);
});
