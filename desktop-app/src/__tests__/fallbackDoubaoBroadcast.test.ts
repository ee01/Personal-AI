import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  BrowserConversationSnapshot,
  BrowserSendOptions,
  BrowserSendResult,
  BrowserSessionAdapter,
  BrowserStatus,
  BrowserThreadSnapshot,
} from '../browserSession.js';
import { FallbackDoubaoBroadcast } from '../transports/FallbackDoubaoBroadcast.js';

type MethodName =
  | 'openLogin'
  | 'sendTranscript'
  | 'probeAuthStatus'
  | 'findThreadByTitle';

function createAdapter(
  name: string,
  options: { failMethods?: MethodName[]; unsentMethods?: MethodName[] } = {},
): BrowserSessionAdapter & { calls: MethodName[] } {
  const calls: MethodName[] = [];
  const shouldFail = (method: MethodName) =>
    options.failMethods?.includes(method);
  const shouldReturnUnsent = (method: MethodName) =>
    options.unsentMethods?.includes(method);

  return {
    calls,
    async ensureStarted() {
      return undefined;
    },
    async openLogin() {
      calls.push('openLogin');
      if (shouldFail('openLogin')) throw new Error(`${name} open failed`);
      return `https://www.doubao.com/chat/${name}`;
    },
    async openThread(url: string): Promise<BrowserThreadSnapshot> {
      return { url, threadId: `${name}-thread` };
    },
    async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
      return [];
    },
    async sendTranscript(
      _transcript: string,
      _threadUrl?: string,
      _options?: BrowserSendOptions,
    ): Promise<BrowserSendResult> {
      calls.push('sendTranscript');
      if (shouldFail('sendTranscript')) throw new Error(`${name} send failed`);
      if (shouldReturnUnsent('sendTranscript')) {
        return {
          sent: false,
          url: `https://www.doubao.com/chat/${name}`,
          threadId: name,
          error: `${name} did not verify sent text`,
          verified: false,
          messageVisible: false,
        };
      }
      return {
        sent: true,
        url: `https://www.doubao.com/chat/${name}`,
        threadId: name,
      };
    },
    async probeAuthStatus(): Promise<'connected' | 'needs_login'> {
      calls.push('probeAuthStatus');
      if (shouldFail('probeAuthStatus')) {
        throw new Error(`${name} probe failed`);
      }
      return 'connected';
    },
    async findThreadByTitle(
      title: string,
    ): Promise<BrowserThreadSnapshot | null> {
      calls.push('findThreadByTitle');
      if (shouldFail('findThreadByTitle')) {
        throw new Error(`${name} find failed`);
      }
      return {
        title,
        threadId: `${name}-thread`,
        url: `https://www.doubao.com/chat/${name}-thread`,
      };
    },
    status(): BrowserStatus {
      return { running: true };
    },
    async close() {
      return undefined;
    },
  };
}

test('FallbackDoubaoBroadcast uses webpage-mcp when selected and healthy', async () => {
  const webpageMcp = createAdapter('webpage_mcp');
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const result = await broadcast.sendTranscript('hello');

  assert.equal(result.threadId, 'webpage_mcp');
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.deepEqual(webpageMcp.calls, ['sendTranscript']);
  assert.deepEqual(playwright.calls, []);
});

test('FallbackDoubaoBroadcast falls back to managed Chromium and keeps cooldown', async () => {
  const webpageMcp = createAdapter('webpage_mcp', {
    failMethods: ['sendTranscript'],
  });
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const first = await broadcast.sendTranscript('first');
  const second = await broadcast.sendTranscript('second');

  assert.equal(first.threadId, 'playwright');
  assert.equal(first.transportMode, 'playwright');
  assert.match(first.transportFallbackReason || '', /webpage_mcp send failed/);
  assert.equal(second.threadId, 'playwright');
  assert.equal(second.transportMode, 'playwright');
  const status = broadcast.status();
  assert.equal(status.transport?.mode, 'playwright');
  assert.equal(status.transport?.preferredMode, 'webpage_mcp');
  assert.match(status.transport?.fallbackCooldownUntil || '', /^\d{4}-/);
  assert.match(status.transport?.fallbackReason || '', /webpage_mcp send failed/);
  assert.deepEqual(webpageMcp.calls, ['sendTranscript']);
  assert.deepEqual(playwright.calls, ['sendTranscript', 'sendTranscript']);
});

test('FallbackDoubaoBroadcast retries webpage-mcp login during fallback cooldown', async () => {
  const webpageMcp = createAdapter('webpage_mcp', {
    failMethods: ['sendTranscript'],
  });
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const first = await broadcast.sendTranscript('first');
  const loginUrl = await broadcast.openLogin();

  assert.equal(first.threadId, 'playwright');
  assert.equal(loginUrl, 'https://www.doubao.com/chat/webpage_mcp');
  assert.deepEqual(webpageMcp.calls, ['sendTranscript', 'openLogin']);
  assert.deepEqual(playwright.calls, ['sendTranscript']);
  assert.equal(broadcast.status().lastError, undefined);
});

test('FallbackDoubaoBroadcast retries webpage-mcp thread lookup during fallback cooldown', async () => {
  const webpageMcp = createAdapter('webpage_mcp', {
    failMethods: ['sendTranscript'],
  });
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const first = await broadcast.sendTranscript('first');
  const found = await broadcast.findThreadByTitle('手机版对话');

  assert.equal(first.threadId, 'playwright');
  assert.equal(found?.threadId, 'webpage_mcp-thread');
  assert.deepEqual(webpageMcp.calls, ['sendTranscript', 'findThreadByTitle']);
  assert.deepEqual(playwright.calls, ['sendTranscript']);
  assert.equal(broadcast.status().lastError, undefined);
});

test('FallbackDoubaoBroadcast falls back when webpage-mcp reports an unsent transcript', async () => {
  const webpageMcp = createAdapter('webpage_mcp', {
    unsentMethods: ['sendTranscript'],
  });
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const first = await broadcast.sendTranscript('first');
  const second = await broadcast.sendTranscript('second');

  assert.equal(first.sent, true);
  assert.equal(first.threadId, 'playwright');
  assert.equal(first.transportMode, 'playwright');
  assert.match(first.transportFallbackReason || '', /did not verify sent text/);
  assert.equal(second.threadId, 'playwright');
  assert.match(
    broadcast.status().transport?.fallbackCooldownUntil || '',
    /^\d{4}-/,
  );
  assert.deepEqual(webpageMcp.calls, ['sendTranscript']);
  assert.deepEqual(playwright.calls, ['sendTranscript', 'sendTranscript']);
  assert.match(
    broadcast.status().lastError || '',
    /did not verify sent text/,
  );
});

test('FallbackDoubaoBroadcast does not retry managed Chromium twice after an unsent webpage-mcp result', async () => {
  const webpageMcp = createAdapter('webpage_mcp', {
    unsentMethods: ['sendTranscript'],
  });
  const playwright = createAdapter('playwright', {
    failMethods: ['sendTranscript'],
  });
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  await assert.rejects(
    () => broadcast.sendTranscript('first'),
    /playwright send failed/,
  );

  assert.deepEqual(webpageMcp.calls, ['sendTranscript']);
  assert.deepEqual(playwright.calls, ['sendTranscript']);
  assert.match(
    broadcast.status().lastError || '',
    /managed Chromium fallback also failed/,
  );
});

test('FallbackDoubaoBroadcast uses managed Chromium when selected', async () => {
  const webpageMcp = createAdapter('webpage_mcp');
  const playwright = createAdapter('playwright');
  const broadcast = new FallbackDoubaoBroadcast({
    getTransport: () => 'playwright',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  assert.equal(await broadcast.probeAuthStatus(), 'connected');
  const result = await broadcast.sendTranscript('hello');
  assert.equal(result.transportMode, 'playwright');
  assert.deepEqual(webpageMcp.calls, []);
  assert.deepEqual(playwright.calls, ['probeAuthStatus', 'sendTranscript']);
});
