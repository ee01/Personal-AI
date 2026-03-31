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
        message: 'Route POST:/api/v1/providers/context-packages/render not found',
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
