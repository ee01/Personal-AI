import assert from 'node:assert/strict';

import { resolveEventStreamUserId } from '../memory-service/src/routes/events.js';
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

assert.deepEqual(
  resolveEventStreamUserId({
    requestUserId: 'default',
    queryUserId: 'alice.user',
  }),
  { userId: 'alice.user' },
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

console.log('memory events multi-user verification passed');
