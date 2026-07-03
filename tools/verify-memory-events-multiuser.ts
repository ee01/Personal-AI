import assert from 'node:assert/strict';

import {
  buildEventStreamConnectionReceipt,
  resolveEventStreamUserId,
} from '../memory-service/src/routes/events.js';
import { MemoryServiceClient } from '../src/services/MemoryServiceClient.ts';

type StoredConfig = {
  envConfig?: Record<string, string>;
  userinfo?: { username?: string };
};

class FakeEventSource {
  static openedUrls: string[] = [];
  static instances: FakeEventSource[] = [];

  readonly url: string;
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.openedUrls.push(url);
    FakeEventSource.instances.push(this);
  }

  addEventListener(eventType: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(eventType) ?? [];
    listeners.push(listener);
    this.listeners.set(eventType, listeners);
  }

  close(): void {
    this.closed = true;
  }
}

function resetFakeEventSource(): void {
  FakeEventSource.openedUrls = [];
  FakeEventSource.instances = [];
}

function installChromeStorageStub(config: StoredConfig): void {
  (globalThis as any).chrome = {
    storage: {
      local: {
        get(_keys: unknown, callback?: (result: StoredConfig) => void) {
          if (callback) {
            queueMicrotask(() => callback(config));
            return undefined;
          }
          return Promise.resolve(config);
        },
      },
    },
  };
}

async function waitForEventSourceOpen(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function readRequestHeader(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  const lowerName = name.toLowerCase();
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === lowerName);
    return match?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return record[name] ?? record[lowerName] ?? null;
}

assert.deepEqual(
  resolveEventStreamUserId({
    requestUserId: 'default',
    requestFallbackToDefault: true,
    queryUserId: 'alice.user',
  }),
  {
    userId: 'alice.user',
    identitySource: 'query',
    fallbackToDefault: false,
    storageKey: 'data/users/alice.user/memory.db',
    eventFilter: 'matching_user_or_global',
  },
  'SSE user resolution should prefer EventSource query userId over default auth fallback',
);

assert.equal(
  resolveEventStreamUserId({
    requestUserId: 'default',
    queryUserId: '../../alice',
  }).error?.includes('Invalid userId query parameter format'),
  true,
  'SSE user resolution should reject path-like query userIds',
);

assert.deepEqual(
  buildEventStreamConnectionReceipt(
    resolveEventStreamUserId({
      requestUserId: 'default',
      requestFallbackToDefault: true,
    }),
    12345,
  ),
  {
    message: 'SSE stream connected',
    timestamp: 12345,
    userId: 'default',
    user: {
      id: 'default',
      isolation: 'per_user_event_stream',
      identitySource: 'default_fallback',
      fallbackToDefault: true,
      storageKey: 'data/users/default/memory.db',
      eventFilter: 'matching_user_or_global',
    },
  },
  'connected receipt should make default fallback and event-filter scope explicit',
);

(globalThis as any).EventSource = FakeEventSource;
installChromeStorageStub({
  envConfig: {
    MEMORY_SERVICE_BASE_URL: 'http://memory.example.test/api/v1',
  },
  userinfo: {
    username: 'esone.qiu',
  },
});

const client = new MemoryServiceClient();
const unsubscribe = client.subscribeEvents(() => undefined);
assert.equal(
  FakeEventSource.openedUrls.length,
  0,
  'subscribeEvents should not open before async config/userId resolution finishes',
);

await waitForEventSourceOpen();

assert.deepEqual(FakeEventSource.openedUrls, [
  'http://memory.example.test/api/v1/events?userId=esone.qiu',
]);
assert.equal(client.getUserId(), 'esone.qiu');

unsubscribe();
assert.equal(FakeEventSource.instances[0]?.closed, true);

resetFakeEventSource();
installChromeStorageStub({
  envConfig: {
    MEMORY_SERVICE_BASE_URL: 'http://memory.example.test/api/v1',
  },
});

const fallbackEventClient = new MemoryServiceClient();
const fallbackUnsubscribe = fallbackEventClient.subscribeEvents(() => undefined);

await waitForEventSourceOpen();

assert.deepEqual(FakeEventSource.openedUrls, [
  'http://memory.example.test/api/v1/events',
]);
assert.equal(fallbackEventClient.getUserId(), 'default');

fallbackUnsubscribe();
assert.equal(FakeEventSource.instances[0]?.closed, true);

const capturedFetches: Array<{
  url: string;
  method: string;
  userHeader: string | null;
}> = [];

(globalThis as any).fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  capturedFetches.push({
    url: String(input),
    method: init?.method ?? 'GET',
    userHeader: readRequestHeader(init?.headers, 'X-User-Id'),
  });

  return new Response(JSON.stringify({ id: 'fake-memory', status: 'created' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const fallbackHttpClient = new MemoryServiceClient({
  baseUrl: 'http://memory.example.test/api/v1',
});
await fallbackHttpClient.ingest({
  content: 'unresolved default identity must not become explicit default',
  sourceType: 'manual',
});
assert.equal(
  capturedFetches.at(-1)?.userHeader,
  null,
  'unresolved default identity should omit X-User-Id so write guard can fail closed',
);

const explicitDefaultClient = new MemoryServiceClient({
  baseUrl: 'http://memory.example.test/api/v1',
  userId: 'default',
});
await explicitDefaultClient.ingest({
  content: 'explicit default identity remains intentional and visible',
  sourceType: 'manual',
});
assert.equal(
  capturedFetches.at(-1)?.userHeader,
  'default',
  'explicitly configured default user should still send X-User-Id: default',
);

console.log('memory events multi-user verification passed');
