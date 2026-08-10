import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MEMORY_SERVICE_BASE_URL } from '../../memoryServiceConfig.js';
import { MemoryServiceClient } from '../MemoryServiceClient.js';

interface StoredConfigFixture {
  envConfig?: {
    MEMORY_SERVICE_BASE_URL?: string;
  };
  userinfo?: {
    username?: string;
  };
}

async function captureOutreachRequestUrl(
  stored: StoredConfigFixture,
): Promise<string> {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  let requestedUrl = '';

  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (
          _keys: unknown,
          callback: (result: StoredConfigFixture) => void,
        ) => {
          callback(stored);
        },
      },
    },
  };
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ session: { id: 'message-reaction-session' } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const client = new MemoryServiceClient();
    await client.createOutreachSessionFromMessage({
      chatId: 'chat-default-url',
      postId: 'post-default-url',
      messageText: 'Please confirm the release owner.',
      informationGoal: '确认发布负责人',
    });
    return requestedUrl;
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).chrome = previousChrome;
  }
}

test('missing envConfig uses the same build default shown by Options', async () => {
  const requestedUrl = await captureOutreachRequestUrl({
    userinfo: { username: 'esone.qiu' },
  });

  assert.equal(
    requestedUrl,
    `${DEFAULT_MEMORY_SERVICE_BASE_URL}/outreach/sessions/from-message`,
  );
  assert.notEqual(
    requestedUrl,
    'http://localhost:3210/api/v1/outreach/sessions/from-message',
  );
});

test('stored Memory Service URL overrides the build default', async () => {
  const requestedUrl = await captureOutreachRequestUrl({
    envConfig: {
      MEMORY_SERVICE_BASE_URL: 'https://memory.example.test/api/v1',
    },
    userinfo: { username: 'esone.qiu' },
  });

  assert.equal(
    requestedUrl,
    'https://memory.example.test/api/v1/outreach/sessions/from-message',
  );
});
