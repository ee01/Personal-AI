import assert from 'node:assert/strict';
import test from 'node:test';

import { WebpageMcpHost } from '../explorer/transports/WebpageMcpHost.js';

test('WebpageMcpHost.getInstance returns the same singleton', () => {
  const a = WebpageMcpHost.getInstance();
  const b = WebpageMcpHost.getInstance();
  assert.strictEqual(a, b, 'Singleton should return the same instance');
});

test('WebpageMcpHost initial status is not running and not connected', () => {
  // Each test should work with a fresh host — reset the singleton via stop()
  // Note: we can't easily reset the singleton in this architecture, but we
  // can test that an unstarted host reports the correct initial state.
  const host = new (WebpageMcpHost as unknown as new () => WebpageMcpHost)();
  const status = host.getStatus();
  assert.equal(status.running, false);
  assert.equal(status.extensionConnected, false);
});

test('WebpageMcpHost.getStatus returns a copy, not the internal object', () => {
  const host = new (WebpageMcpHost as unknown as new () => WebpageMcpHost)();
  const s1 = host.getStatus();
  const s2 = host.getStatus();
  assert.notStrictEqual(s1, s2, 'getStatus should return a new object each time');
  assert.deepEqual(s1, s2, 'Both copies should have equal values');
});

test('WebpageMcpHost.callTool throws when host is not running', async () => {
  // Create a fresh private instance that we know is not started
  const host = new (WebpageMcpHost as unknown as new () => WebpageMcpHost)();
  // Intercept start() so it doesn't actually spawn a process
  (host as unknown as { doStart: () => Promise<void> }).doStart = async () => {
    throw new Error('Cannot start in test environment');
  };

  await assert.rejects(
    () => host.callTool('get_windows_and_tabs', {}),
    (err: Error) => {
      assert.ok(err.message.includes('not running') || err.message.includes('Cannot start'));
      return true;
    },
  );
});
