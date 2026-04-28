import assert from 'node:assert/strict';
import test from 'node:test';

import { BridgeMemoryServiceClient } from '../memoryServiceClient.js';

function createClient(baseUrl = 'http://127.0.0.1:3210') {
  return new BridgeMemoryServiceClient(() => ({
    memoryServiceBaseUrl: baseUrl,
    memoryServiceUserId: 'tester',
    autoSync: true,
    pollIntervalMs: 300_000,
    stableMemoryIntervalMs: 43_200_000,
    mobileBriefingIntervalMs: 14_400_000,
    reminderSyncIntervalMs: 900_000,
  }));
}

test('testConnection probes provider capabilities after health', async () => {
  const client = createClient();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await client.testConnection();
    assert.equal(result.ok, true);
    assert.deepEqual(calls, [
      'http://127.0.0.1:3210/api/v1/health',
      'http://127.0.0.1:3210/api/v1/providers/doubao/capabilities',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('renderContextPackage surfaces a compatibility error when provider routes are missing', async () => {
  const client = createClient('http://10.0.0.8:3210');
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        message:
          'Route POST:/api/v1/providers/context-packages/render not found',
        error: 'Not Found',
        statusCode: 404,
      }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        client.renderContextPackage({
          provider: 'doubao',
          scenario: 'stable_memory',
        }),
      /does not support Doubao Bridge provider APIs/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getStats requests the memory service stats endpoint', async () => {
  const client = createClient();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return new Response(
      JSON.stringify({
        messages: { total: 10, today: 1, thisWeek: 4, last90Days: 9 },
        entities: { total: 0, byType: {} },
        chunks: { total: 0 },
        relationships: { total: 0 },
        watchedProjects: { active: 0 },
        notifications: { pending: 0, sentToday: 0 },
        confirmRequests: { pending: 0 },
        memory: {
          temporary: 0,
          working: 0,
          consolidated: 0,
          core: 0,
          forgotten: 0,
          archived: 0,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const stats = await client.getStats();
    assert.equal(stats.messages.last90Days, 9);
    assert.deepEqual(calls, ['http://127.0.0.1:3210/api/v1/stats']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractFromChat posts chat segments to the extractor endpoint', async () => {
  const client = createClient();
  const calls: Array<{
    url: string;
    method: string;
    headers: Headers;
    body: string;
  }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: String(init?.body ?? ''),
    });
    return new Response(
      JSON.stringify({
        artifacts: [],
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
    const result = await client.extractFromChat({
      source: 'chatgpt',
      scope: 'work',
      autoClassify: true,
      segments: [
        {
          id: 'msg-1',
          speaker: 'user',
          timestamp: 1_710_000_123,
          text: 'remember this',
        },
      ],
    });

    assert.equal(result.scopeUsed, 'work');
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      'http://127.0.0.1:3210/api/v1/extractor/from-chat',
    );
    assert.equal(calls[0]?.method, 'POST');
    assert.equal(calls[0]?.headers.get('x-user-id'), 'tester');
    assert.deepEqual(JSON.parse(calls[0]?.body ?? '{}'), {
      source: 'chatgpt',
      scope: 'work',
      autoClassify: true,
      segments: [
        {
          id: 'msg-1',
          speaker: 'user',
          timestamp: 1_710_000_123,
          text: 'remember this',
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ask forwards explicit scope to the memory service ask endpoint', async () => {
  const client = createClient();
  const calls: Array<{ url: string; method: string; body: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: String(init?.body ?? ''),
    });
    return new Response(
      JSON.stringify({
        answer: 'ok',
        queryTimeMs: 12,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const result = await client.ask(
      'what changed?',
      'recent notes',
      true,
      'both',
    );
    assert.equal(result.answer, 'ok');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'http://127.0.0.1:3210/api/v1/ask');
    assert.equal(calls[0]?.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0]?.body ?? '{}'), {
      query: 'what changed?',
      context: 'recent notes',
      includeEvidence: true,
      scope: 'both',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deleteMemoriesBySourceScope deletes memories by source and scope', async () => {
  const client = createClient();
  const calls: Array<{ url: string; method: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
    });
    return new Response(
      JSON.stringify({
        source: 'chatgpt',
        scope: 'personal',
        deletedMessages: 3,
        deletedChunks: 7,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const result = await client.deleteMemoriesBySourceScope(
      'chatgpt',
      'personal',
    );
    assert.equal(result.deletedMessages, 3);
    assert.equal(result.deletedChunks, 7);
    assert.deepEqual(calls, [
      {
        url: 'http://127.0.0.1:3210/api/v1/memories?source=chatgpt&scope=personal',
        method: 'DELETE',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
