import assert from 'node:assert/strict';

import { ConcernedItemsSyncService } from '../src/services/ConcernedItemsSyncService.ts';

const storage: Record<string, any> = {
  envConfig: {
    MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
    MEMORY_SERVICE_TIMEOUT: 30000,
  },
  userinfo: {
    username: 'current.user',
  },
  concernedItems: [
    {
      id: 'manual-1',
      text: 'manual rule',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
    {
      id: 'outreach:legacy-system-item',
      source: 'outreach',
      text: 'legacy internal item',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ],
  concernedItemsSyncState: {
    deviceId: 'device-1',
    snapshotVersion: 0,
    configDirty: true,
    contentUpdatedAt: new Date().toISOString(),
  },
};

const snapshotPushes: any[] = [];
let remoteSnapshot = {
  version: 0,
  updatedAt: new Date().toISOString(),
  contentUpdatedAt: new Date().toISOString(),
  items: [] as any[],
};

function installChromeMock() {
  const local = {
    async get(
      keys: string | string[],
      callback?: (result: Record<string, any>) => void,
    ) {
      let result: Record<string, any>;
      if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, storage[key]]));
      } else {
        result = { [keys]: storage[keys] };
      }
      if (callback) callback(result);
      return result;
    },
    async set(value: Record<string, any>) {
      Object.assign(storage, value);
    },
  };

  (globalThis as any).chrome = {
    storage: {
      local,
      onChanged: {
        addListener() {},
        removeListener() {},
      },
    },
  };
}

function installFetchMock() {
  (globalThis as any).fetch = async (
    input: string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    if (
      url.startsWith('http://mock-memory/api/v1/concerned-items') &&
      init?.method === 'PUT'
    ) {
      snapshotPushes.push(body);
      remoteSnapshot = {
        version: 1,
        updatedAt: new Date().toISOString(),
        contentUpdatedAt: new Date().toISOString(),
        items: body?.items || [],
      };
      return new Response(
        JSON.stringify({
          ...remoteSnapshot,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (
      url.startsWith('http://mock-memory/api/v1/concerned-items') &&
      init?.method === 'GET'
    ) {
      return new Response(JSON.stringify(remoteSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('http://mock-memory/api/v1/follow-thread-hits')) {
      return new Response(
        JSON.stringify({ items: [], total: 0, limit: 500, offset: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };
}

async function main() {
  installChromeMock();
  installFetchMock();

  const service = ConcernedItemsSyncService.getInstance();
  await service.syncOnStartup();

  assert.equal(snapshotPushes.length, 1);
  assert.deepEqual(
    snapshotPushes[0].items.map((item: any) => item.id),
    ['manual-1'],
  );

  remoteSnapshot = {
    version: 2,
    updatedAt: new Date().toISOString(),
    contentUpdatedAt: new Date().toISOString(),
    items: [
      {
        id: 'manual-remote',
        text: 'remote manual rule',
        expiredAt: 0,
        notifyMethod: 'bot',
      },
    ],
  };

  storage.concernedItemsSyncState = {
    ...storage.concernedItemsSyncState,
    snapshotVersion: 1,
    configDirty: false,
  };

  await service.runPeriodicSync();

  const afterPullItems = storage.concernedItems || [];
  assert.ok(
    afterPullItems.some((item: any) => item.id === 'manual-remote'),
    'remote manual snapshot should apply',
  );
  assert.ok(
    afterPullItems.some(
      (item: any) => item.id === 'outreach:legacy-system-item',
    ),
    'local hidden system item should survive remote snapshot apply',
  );

  console.log('verify-memory-entry-sync: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
