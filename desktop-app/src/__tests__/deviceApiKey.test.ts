import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DeviceApiKeyManager,
  type DeviceApiKeyIssuerSettings,
} from '../deviceApiKey.js';

const BASE_URL = 'http://127.0.0.1:3210';

interface Harness {
  manager: DeviceApiKeyManager;
  calls: Array<{ url: string; body: Record<string, unknown>; auth?: string }>;
  settings: DeviceApiKeyIssuerSettings;
  setNow: (value: number) => void;
  file: string;
}

async function createHarness(
  respond: (
    call: number,
    body: Record<string, unknown>,
  ) => { status: number; payload: unknown },
  overrides: Partial<DeviceApiKeyIssuerSettings> = {},
): Promise<Harness> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'device-key-test-'));
  const file = path.join(dir, 'device-key.json');
  const calls: Harness['calls'] = [];
  const settings: DeviceApiKeyIssuerSettings = {
    memoryServiceBaseUrl: BASE_URL,
    memoryServiceUserId: 'tester',
    memoryServiceApiKey: 'service-key',
    ...overrides,
  };
  let now = 1_700_000_000_000;

  const manager = new DeviceApiKeyManager({
    file,
    readSettings: () => settings,
    now: () => now,
    platform: 'darwin',
    log: () => undefined,
    fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
      const headers = (init?.headers || {}) as Record<string, string>;
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      calls.push({
        url: String(input),
        body,
        auth: headers.Authorization,
      });
      const { status, payload } = respond(calls.length, body);
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });

  return { manager, calls, settings, setNow: (value) => (now = value), file };
}

function issuedKey(secret: string) {
  return {
    status: 200,
    payload: {
      userId: 'tester',
      token: `pak.dGVzdGVy.${secret}`,
      key: {
        id: `id-${secret}`,
        keyPrefix: `pak.dGVzdGVy.${secret.slice(0, 6)}`,
        label: 'Desktop · darwin · abcdef',
        createdAt: 1_700_000_000,
      },
    },
  };
}

test('mints a device key from the configured issuer credential', async () => {
  const harness = await createHarness(() => issuedKey('alpha'));

  const outcome = await harness.manager.ensure();

  assert.equal(outcome.status, 'ok');
  assert.equal(harness.manager.getToken(), 'pak.dGVzdGVy.alpha');
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].url, `${BASE_URL}/api/v1/users/me/keys`);
  assert.equal(harness.calls[0].auth, 'Bearer service-key');
  assert.deepEqual(harness.calls[0].body.scopes, [
    'memory.read',
    'memory.write',
  ]);
  assert.match(String(harness.calls[0].body.label), /^Desktop · darwin · /);
});

test('reuses the cached key instead of minting on every call', async () => {
  const harness = await createHarness(() => issuedKey('alpha'));

  await harness.manager.ensure();
  await harness.manager.ensure();

  assert.equal(harness.calls.length, 1);
});

test('keeps a stable label across restarts so admin approval can be matched', async () => {
  const harness = await createHarness(() => issuedKey('alpha'));
  await harness.manager.ensure();
  const firstLabel = harness.manager.getStatus().label;

  const reopened = new DeviceApiKeyManager({
    file: harness.file,
    readSettings: () => harness.settings,
    platform: 'darwin',
    log: () => undefined,
    fetchImpl: (async () => {
      throw new Error('should not issue again');
    }) as typeof fetch,
  });
  await reopened.init();

  assert.equal(reopened.getStatus().label, firstLabel);
  assert.equal(reopened.getToken(), 'pak.dGVzdGVy.alpha');
});

test('reports a claim gate instead of retrying blindly', async () => {
  const harness = await createHarness(() => ({
    status: 409,
    payload: {
      error: 'user_already_claimed',
      userId: 'tester',
      verifyMethods: ['google'],
      adminContact: 'admin@example.com',
      requestId: 'req-1',
    },
  }));

  const outcome = await harness.manager.ensure();

  assert.equal(outcome.status, 'needs_verification');
  assert.equal(harness.manager.getToken(), undefined);
  assert.deepEqual(
    outcome.status === 'needs_verification' ? outcome.verifyMethods : [],
    ['google'],
  );

  // A second call inside the backoff window must not hammer the server.
  await harness.manager.ensure();
  assert.equal(harness.calls.length, 1);
});

test('consumes an admin-approved request when a requestId is supplied', async () => {
  const harness = await createHarness((call, body) =>
    body.requestId === 'req-1'
      ? issuedKey('approved')
      : {
          status: 409,
          payload: { error: 'request_not_approved', requestId: 'req-1' },
        },
  );

  const blocked = await harness.manager.ensure();
  assert.equal(blocked.status, 'pending_approval');

  const issued = await harness.manager.ensure({ requestId: 'req-1' });
  assert.equal(issued.status, 'ok');
  assert.equal(harness.manager.getToken(), 'pak.dGVzdGVy.approved');
});

test('backs off after a rate limit and retries once the window passes', async () => {
  let rateLimited = true;
  const harness = await createHarness(() =>
    rateLimited
      ? { status: 429, payload: { error: 'key_issue_rate_limited' } }
      : issuedKey('later'),
  );

  const first = await harness.manager.ensure();
  assert.equal(first.status, 'unavailable');

  await harness.manager.ensure();
  assert.equal(harness.calls.length, 1, 'still inside the backoff window');

  rateLimited = false;
  harness.setNow(1_700_000_000_000 + 16 * 60_000);
  const recovered = await harness.manager.ensure();

  assert.equal(recovered.status, 'ok');
  assert.equal(harness.calls.length, 2);
});

test('rotates the device key after the server rejects it', async () => {
  let secret = 'alpha';
  const harness = await createHarness(() => issuedKey(secret));

  await harness.manager.ensure();
  secret = 'beta';

  const retry = await harness.manager.handleAuthFailure(
    'pak.dGVzdGVy.alpha',
    { error: 'invalid_user_api_key' },
  );

  assert.equal(retry, true);
  assert.equal(harness.manager.getToken(), 'pak.dGVzdGVy.beta');
});

test('does not rotate when the failure is unrelated to the key', async () => {
  const harness = await createHarness(() => issuedKey('alpha'));
  await harness.manager.ensure();

  const retry = await harness.manager.handleAuthFailure(
    'pak.dGVzdGVy.alpha',
    { error: 'user_id_required' },
  );

  assert.equal(retry, false);
  assert.equal(harness.calls.length, 1);
});

test('issues on the spot when the request carried no credential at all', async () => {
  const harness = await createHarness(() => issuedKey('alpha'));

  const retry = await harness.manager.handleAuthFailure(undefined, {
    error: 'authentication_required',
  });

  assert.equal(retry, true);
  assert.equal(harness.manager.getToken(), 'pak.dGVzdGVy.alpha');
});

test('falls back to the bootstrap key when no other credential is configured', async () => {
  const harness = await createHarness(() => issuedKey('alpha'), {
    memoryServiceApiKey: undefined,
    memoryServiceBootstrapKey: 'bootstrap-key',
  });

  await harness.manager.ensure();

  assert.equal(harness.calls[0].auth, 'Bearer bootstrap-key');
});

test('explains the gap when there is nothing to issue with', async () => {
  const harness = await createHarness(() => issuedKey('alpha'), {
    memoryServiceApiKey: undefined,
  });

  const outcome = await harness.manager.ensure();

  assert.equal(outcome.status, 'unavailable');
  assert.equal(
    outcome.status === 'unavailable' ? outcome.reason : '',
    'issuer_missing',
  );
  assert.equal(harness.calls.length, 0);
});
