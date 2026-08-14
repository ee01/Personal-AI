import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_MEMORY_SERVICE_BASE_URL } from '../../memoryServiceConfig.js';
import { MemoryServiceClient } from '../MemoryServiceClient.js';

interface StoredConfigFixture {
  envConfig?: {
    MEMORY_SERVICE_BASE_URL?: string;
    MEMORY_SERVICE_API_KEY?: string;
    MEMORY_SERVICE_BOOTSTRAP_KEY?: string;
  };
  userinfo?: {
    username?: string;
  };
  memoryServiceDeviceKey?: {
    userId: string;
    deviceId?: string;
    id: string;
    token: string;
    keyPrefix?: string;
    label?: string;
    createdAt?: number;
  };
  memoryServiceUserApiKey?: {
    userId: string;
    id?: string;
    token: string;
    keyPrefix?: string;
    createdAt?: number;
  };
}

function installChromeStorage(stored: StoredConfigFixture) {
  const data: Record<string, unknown> = { ...stored };
  (globalThis as any).chrome = {
    storage: {
      local: {
        get: (keys?: unknown, callback?: (result: Record<string, unknown>) => void) => {
          const keyList = Array.isArray(keys)
            ? keys
            : keys && typeof keys === 'object'
              ? Object.keys(keys as object)
              : typeof keys === 'string'
                ? [keys]
                : Object.keys(data);
          const result: Record<string, unknown> = {};
          for (const key of keyList) {
            if (key in data) {
              result[key] = data[key];
            }
          }
          if (typeof callback === 'function') callback(result);
          return Promise.resolve(result);
        },
        set: async (items: Record<string, unknown>) => {
          Object.assign(data, items);
        },
        remove: async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete data[key];
          }
        },
      },
    },
  };
}

async function captureOutreachRequestUrl(
  stored: StoredConfigFixture,
): Promise<string> {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  let requestedUrl = '';

  installChromeStorage(stored);
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

test('explicit baseUrl still sends the stored personal key', async () => {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  let authHeader = '';
  let userHeader = '';

  installChromeStorage({
    userinfo: { username: 'esone.qiu' },
    memoryServiceDeviceKey: {
      userId: 'esone.qiu',
      id: 'key-1',
      token: 'pak.esone.qiu.testtoken',
      keyPrefix: 'pak.esone',
    },
  });
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    authHeader = headers.get('Authorization') || '';
    userHeader = headers.get('X-User-Id') || '';
    return new Response(JSON.stringify({ outreachEnabled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://memory.xmnup.com/api/v1',
      userId: 'esone.qiu',
    });
    await client.getRuntimeConfig();
    assert.equal(authHeader, 'Bearer pak.esone.qiu.testtoken');
    assert.equal(userHeader, 'esone.qiu');
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).chrome = previousChrome;
  }
});

test('does not use the read-only help-center key as the device bearer', async () => {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  const requested: Array<{ url: string; auth: string }> = [];

  installChromeStorage({
    envConfig: {
      MEMORY_SERVICE_BOOTSTRAP_KEY: 'test-bootstrap',
    },
    userinfo: { username: 'esone.qiu' },
    memoryServiceUserApiKey: {
      userId: 'esone.qiu',
      id: 'key-help',
      token: 'pak.esone.qiu.helpkey',
    },
  });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requested.push({ url, auth: headers.get('Authorization') || '' });
    if (url.endsWith('/users/me/keys') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          token: 'pak.esone.qiu.devicewrite',
          key: {
            id: 'device-1',
            keyPrefix: 'pak.esone.qiu.device',
            createdAt: 1,
            label: 'Chrome',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({ outreachEnabled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://memory.xmnup.com/api/v1',
      userId: 'esone.qiu',
    });
    await client.getRuntimeConfig();
    assert.equal(
      requested.some((item) => item.url.endsWith('/users/me/keys')),
      true,
    );
    const configCall = requested.find((item) => item.url.endsWith('/config'));
    assert.equal(configCall?.auth, 'Bearer pak.esone.qiu.devicewrite');
    assert.equal(
      requested.every((item) => item.auth !== 'Bearer pak.esone.qiu.helpkey'),
      true,
    );
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).chrome = previousChrome;
  }
});

test('falls back to the help-center key when a writable device key cannot be issued', async () => {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  let configAuth = '';

  installChromeStorage({
    userinfo: { username: 'esone.qiu' },
    memoryServiceUserApiKey: {
      userId: 'esone.qiu',
      id: 'key-help',
      token: 'pak.esone.qiu.helpkey',
    },
  });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (url.endsWith('/users/me/keys') && init?.method === 'POST') {
      return new Response(JSON.stringify({ error: 'issuer_not_trusted' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/config')) {
      configAuth = headers.get('Authorization') || '';
    }
    return new Response(JSON.stringify({ outreachEnabled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://memory.xmnup.com/api/v1',
      userId: 'esone.qiu',
    });
    await client.getRuntimeConfig();
    assert.equal(configAuth, 'Bearer pak.esone.qiu.helpkey');
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).chrome = previousChrome;
  }
});

test('reissues a device key when the stored pak is rejected as invalid', async () => {
  const previousChrome = (globalThis as any).chrome;
  const previousFetch = globalThis.fetch;
  const requested: Array<{ url: string; auth: string; method: string }> = [];

  installChromeStorage({
    envConfig: {
      MEMORY_SERVICE_BOOTSTRAP_KEY: 'test-bootstrap',
    },
    userinfo: { username: 'esone.qiu' },
    memoryServiceDeviceKey: {
      userId: 'esone.qiu',
      id: 'key-stale',
      token: 'pak.esone.qiu.stale',
    },
  });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const method = String(init?.method || 'GET').toUpperCase();
    requested.push({
      url,
      auth: headers.get('Authorization') || '',
      method,
    });
    if (url.endsWith('/users/me/keys') && method === 'POST') {
      return new Response(
        JSON.stringify({
          token: 'pak.esone.qiu.fresh',
          key: {
            id: 'device-fresh',
            keyPrefix: 'pak.esone.qiu.fresh',
            createdAt: 1,
            label: 'Chrome',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/config') && headers.get('Authorization') === 'Bearer pak.esone.qiu.stale') {
      return new Response(JSON.stringify({ error: 'invalid_user_api_key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ outreachEnabled: true, agentExecutors: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const client = new MemoryServiceClient({
      baseUrl: 'http://memory.xmnup.com/api/v1',
      userId: 'esone.qiu',
    });
    await client.getRuntimeConfig();
    const configCalls = requested.filter((item) => item.url.endsWith('/config'));
    assert.equal(configCalls[0]?.auth, 'Bearer pak.esone.qiu.stale');
    assert.equal(
      requested.some(
        (item) =>
          item.url.endsWith('/users/me/keys') &&
          item.method === 'POST' &&
          item.auth === 'Bearer test-bootstrap',
      ),
      true,
    );
    assert.equal(configCalls.at(-1)?.auth, 'Bearer pak.esone.qiu.fresh');
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).chrome = previousChrome;
  }
});
