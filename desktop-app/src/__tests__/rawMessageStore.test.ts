import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RawMessageStore } from '../explorer/index.js';

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('RawMessageStore deduplicates messages and tracks pending extract counts', async () => {
  const tempDir = await createTempDir('explorer-store-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

  try {
    const inserted = store.insertMany([
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        ts: '2026-04-17T10:00:00.000Z',
        role: 'user',
        contentHash: 'hash-1',
        content: 'hello',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        ts: '2026-04-17T10:00:00.000Z',
        role: 'user',
        contentHash: 'hash-1',
        content: 'hello',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-2',
        ts: '2026-04-17T10:01:00.000Z',
        role: 'assistant',
        contentHash: 'hash-2',
        content: 'hi back',
        extractedAt: '2026-04-17T10:02:00.000Z',
      },
    ]);

    assert.equal(inserted, 2);
    assert.deepEqual(store.getStats('chatgpt'), {
      messageCount: 2,
      pendingExtractCount: 1,
      conversationCount: 1,
      artifactCount: 0,
      revokedArtifactCount: 0,
    });

    const preview = store.listMessages({
      source: 'chatgpt',
      conversationId: 'conv-1',
      limit: 10,
    });
    assert.equal(preview.length, 2);
    assert.equal(preview[0]?.messageId, 'msg-2');

    const marked = store.markExtracted([
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-1',
      },
    ]);
    assert.equal(marked, 1);
    assert.equal(store.getStats('chatgpt').pendingExtractCount, 0);
  } finally {
    store.close();
  }
});

test('RawMessageStore reset removes scoped cache entries', async () => {
  const tempDir = await createTempDir('explorer-store-reset-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

  try {
    store.insertMany([
      {
        source: 'doubao',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        role: 'user',
        contentHash: 'hash-1',
        content: 'first',
      },
      {
        source: 'doubao',
        conversationId: 'conv-2',
        messageId: 'msg-2',
        role: 'assistant',
        contentHash: 'hash-2',
        content: 'second',
      },
    ]);
    store.replaceConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-1',
      extractedAt: '2026-04-17T10:05:00.000Z',
      artifacts: [
        {
          kind: 'fact',
          text: 'artifact-1',
          sourceQuote: 'first',
          conversationRef: 'conv-1',
        },
      ],
    });
    store.replaceConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-2',
      extractedAt: '2026-04-17T10:06:00.000Z',
      artifacts: [
        {
          kind: 'plan',
          text: 'artifact-2',
          sourceQuote: 'second',
          conversationRef: 'conv-2',
        },
      ],
    });

    assert.equal(store.reset('doubao', 'conv-1'), 1);
    assert.deepEqual(store.getStats('doubao'), {
      messageCount: 1,
      pendingExtractCount: 1,
      conversationCount: 1,
      artifactCount: 1,
      revokedArtifactCount: 0,
    });
    assert.deepEqual(store.listConversationArtifacts({ source: 'doubao' }), [
      {
        source: 'doubao',
        conversationId: 'conv-2',
        extractedAt: store.listConversationArtifacts({ source: 'doubao' })[0]!
          .extractedAt,
        scope: undefined,
        revokedAt: undefined,
        revokedScope: undefined,
        kind: 'plan',
        text: 'artifact-2',
        sourceQuote: 'second',
        conversationRef: 'conv-2',
      },
    ]);

    assert.equal(store.reset('doubao'), 1);
    assert.deepEqual(store.getStats('doubao'), {
      messageCount: 0,
      pendingExtractCount: 0,
      conversationCount: 0,
      artifactCount: 0,
      revokedArtifactCount: 0,
    });
    assert.deepEqual(store.listConversationArtifacts({ source: 'doubao' }), []);
  } finally {
    store.close();
  }
});

test('RawMessageStore lists pending messages in chronological order', async () => {
  const tempDir = await createTempDir('explorer-store-pending-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

  try {
    store.insertMany([
      {
        source: 'chatgpt',
        conversationId: 'conv-2',
        messageId: 'msg-3',
        ts: '2026-04-17T10:03:00.000Z',
        role: 'assistant',
        contentHash: 'hash-3',
        content: 'third',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-2',
        ts: '2026-04-17T10:02:00.000Z',
        role: 'assistant',
        contentHash: 'hash-2',
        content: 'second',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        ts: '2026-04-17T10:01:00.000Z',
        role: 'user',
        contentHash: 'hash-1',
        content: 'first',
        extractedAt: '2026-04-17T10:04:00.000Z',
      },
    ]);

    assert.deepEqual(
      store.listPendingMessages({ source: 'chatgpt' }).map((message) => ({
        conversationId: message.conversationId,
        messageId: message.messageId,
      })),
      [
        { conversationId: 'conv-1', messageId: 'msg-2' },
        { conversationId: 'conv-2', messageId: 'msg-3' },
      ],
    );
  } finally {
    store.close();
  }
});

test('RawMessageStore lists conversation summaries for browsing', async () => {
  const tempDir = await createTempDir('explorer-store-conversations-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

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
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        messageId: 'msg-2',
        ts: '2026-04-17T10:01:00.000Z',
        role: 'assistant',
        contentHash: 'hash-2',
        content: 'latest in conv 1',
        extractedAt: '2026-04-17T10:02:00.000Z',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-2',
        messageId: 'msg-3',
        ts: '2026-04-17T11:00:00.000Z',
        role: 'user',
        contentHash: 'hash-3',
        content: 'latest overall',
      },
    ]);
    store.replaceConversationArtifacts({
      source: 'chatgpt',
      conversationId: 'conv-1',
      extractedAt: '2026-04-17T10:03:00.000Z',
      artifacts: [
        {
          kind: 'fact',
          text: 'artifact-1',
          sourceQuote: 'latest in conv 1',
          conversationRef: 'conv-1',
        },
      ],
    });

    assert.deepEqual(store.listConversations({ source: 'chatgpt' }), [
      {
        source: 'chatgpt',
        conversationId: 'conv-2',
        latestTs: '2026-04-17T11:00:00.000Z',
        messageCount: 1,
        pendingMessageCount: 1,
        extractedMessageCount: 0,
        artifactCount: 0,
        revokedArtifactCount: 0,
        latestMessagePreview: 'latest overall',
      },
      {
        source: 'chatgpt',
        conversationId: 'conv-1',
        latestTs: '2026-04-17T10:01:00.000Z',
        messageCount: 2,
        pendingMessageCount: 1,
        extractedMessageCount: 1,
        artifactCount: 1,
        revokedArtifactCount: 0,
        latestMessagePreview: 'latest in conv 1',
      },
    ]);
  } finally {
    store.close();
  }
});

test('RawMessageStore.listAllArtifacts paginates and filters across sources', async () => {
  const tempDir = await createTempDir('explorer-store-listall-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

  try {
    store.replaceConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-d-1',
      extractedAt: '2026-04-17T10:00:00.000Z',
      artifacts: [
        {
          kind: 'fact',
          text: 'doubao fact about coffee',
          sourceQuote: 'I drink espresso',
          conversationRef: 'conv-d-1',
        },
        {
          kind: 'preference',
          text: 'prefers oat milk',
          sourceQuote: 'oat milk please',
          conversationRef: 'conv-d-1',
        },
      ],
    });
    store.replaceConversationArtifacts({
      source: 'chatgpt',
      conversationId: 'conv-c-1',
      extractedAt: '2026-04-18T10:00:00.000Z',
      artifacts: [
        {
          kind: 'plan',
          text: 'will visit Tokyo in May',
          sourceQuote: 'Tokyo trip',
          conversationRef: 'conv-c-1',
        },
      ],
    });

    // Default: newest first across all sources.
    const allItems = store.listAllArtifacts();
    assert.equal(allItems.length, 3);
    assert.equal(allItems[0]!.source, 'chatgpt');
    assert.equal(allItems[0]!.text, 'will visit Tokyo in May');

    // Source filter.
    const onlyDoubao = store.listAllArtifacts({ source: 'doubao' });
    assert.equal(onlyDoubao.length, 2);
    assert.ok(onlyDoubao.every((a) => a.source === 'doubao'));

    // Query filter matches text.
    const coffee = store.listAllArtifacts({ query: 'coffee' });
    assert.equal(coffee.length, 1);
    assert.equal(coffee[0]!.text, 'doubao fact about coffee');

    // Query filter matches source_quote (case-insensitive).
    const oat = store.listAllArtifacts({ query: 'OAT' });
    assert.equal(oat.length, 1);
    assert.equal(oat[0]!.kind, 'preference');

    // Pagination.
    const page1 = store.listAllArtifacts({ limit: 2, offset: 0 });
    const page2 = store.listAllArtifacts({ limit: 2, offset: 2 });
    assert.equal(page1.length, 2);
    assert.equal(page2.length, 1);

    // Counts honor filters too.
    assert.equal(store.countAllArtifacts(), 3);
    assert.equal(store.countAllArtifacts({ source: 'doubao' }), 2);
    assert.equal(store.countAllArtifacts({ query: 'tokyo' }), 1);
  } finally {
    store.close();
  }
});

test('RawMessageStore marks source-scope artifacts revoked while keeping audit rows', async () => {
  const tempDir = await createTempDir('explorer-store-revoke-');
  const store = new RawMessageStore(path.join(tempDir, 'raw-messages.sqlite'));

  try {
    store.insertMany([
      {
        source: 'doubao',
        conversationId: 'conv-work',
        messageId: 'msg-work',
        role: 'user',
        contentHash: 'hash-work',
        content: 'work message',
      },
      {
        source: 'doubao',
        conversationId: 'conv-personal',
        messageId: 'msg-personal',
        role: 'user',
        contentHash: 'hash-personal',
        content: 'personal message',
      },
    ]);
    store.replaceConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-work',
      scope: 'work',
      artifacts: [
        {
          kind: 'fact',
          text: 'work artifact',
          sourceQuote: 'work message',
          conversationRef: 'conv-work',
        },
      ],
    });
    store.replaceConversationArtifacts({
      source: 'doubao',
      conversationId: 'conv-personal',
      scope: 'personal',
      artifacts: [
        {
          kind: 'preference',
          text: 'personal artifact',
          sourceQuote: 'personal message',
          conversationRef: 'conv-personal',
        },
      ],
    });

    assert.deepEqual(store.getRevokePreview('doubao', 'personal'), {
      scope: 'personal',
      activeArtifactCount: 1,
      legacyUnscopedArtifactCount: 0,
      revokedArtifactCount: 0,
    });
    assert.equal(
      store.markArtifactsRevoked(
        'doubao',
        'personal',
        '2026-05-30T08:00:00.000Z',
      ),
      1,
    );
    assert.deepEqual(store.getStats('doubao'), {
      messageCount: 2,
      pendingExtractCount: 2,
      conversationCount: 2,
      artifactCount: 1,
      revokedArtifactCount: 1,
    });
    assert.deepEqual(store.getRevokePreview('doubao', 'personal'), {
      scope: 'personal',
      activeArtifactCount: 0,
      legacyUnscopedArtifactCount: 0,
      revokedArtifactCount: 1,
    });
    assert.equal(store.listAllArtifacts({ source: 'doubao' }).length, 1);
    assert.deepEqual(
      store
        .listConversationArtifacts({ source: 'doubao' })
        .map((artifact) => ({
          text: artifact.text,
          scope: artifact.scope,
          revokedAt: artifact.revokedAt,
          revokedScope: artifact.revokedScope,
        })),
      [
        {
          text: 'personal artifact',
          scope: 'personal',
          revokedAt: '2026-05-30T08:00:00.000Z',
          revokedScope: 'personal',
        },
        {
          text: 'work artifact',
          scope: 'work',
          revokedAt: undefined,
          revokedScope: undefined,
        },
      ],
    );
  } finally {
    store.close();
  }
});
