import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ChatGPTApiClient,
  ChatGPTConversationResponse,
  ChatGPTConversationSummary,
} from '../explorer/sources/ChatGPTSource.js';
import {
  FallbackChatGPTClient,
  type FallbackChatGPTClientOptions,
} from '../explorer/sources/FallbackChatGPTClient.js';
import type { TransportMode } from '../explorer/transports/types.js';

function makeClient(
  label: 'mcp' | 'pw',
  options?: { failOpen?: boolean; throwAccessToken?: Error },
): ChatGPTApiClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async openLogin(): Promise<string> {
      calls.push('openLogin');
      if (options?.failOpen) throw new Error(`${label}-openLogin-failed`);
      return `${label}://login`;
    },
    async getAccessToken(): Promise<string | undefined> {
      calls.push('getAccessToken');
      if (options?.throwAccessToken) throw options.throwAccessToken;
      return `${label}-token`;
    },
    async listConversationsPage(
      _accessToken: string | undefined,
      _offset: number,
      _limit: number,
    ): Promise<ChatGPTConversationSummary[]> {
      calls.push('listConversationsPage');
      return [{ id: `${label}-1`, title: 'fake' }];
    },
    async getConversation(
      _accessToken: string | undefined,
      _conversationId: string,
    ): Promise<ChatGPTConversationResponse> {
      calls.push('getConversation');
      return { id: 'c1', current_node: 'n1', mapping: {} };
    },
    async close(): Promise<void> {
      calls.push('close');
    },
  };
}

function makeOptions(
  transport: TransportMode,
  mcpOptions?: Parameters<typeof makeClient>[1],
  pwOptions?: Parameters<typeof makeClient>[1],
): FallbackChatGPTClientOptions & {
  mcp: ReturnType<typeof makeClient>;
  pw: ReturnType<typeof makeClient>;
} {
  const mcp = makeClient('mcp', mcpOptions);
  const pw = makeClient('pw', pwOptions);
  return {
    getTransport: () => transport,
    webpageMcpClient: mcp,
    playwrightClient: pw,
    mcp,
    pw,
  };
}

test('FallbackChatGPTClient routes to playwright when transport=playwright', async () => {
  const opts = makeOptions('playwright');
  const client = new FallbackChatGPTClient(opts);

  const token = await client.getAccessToken();
  assert.equal(token, 'pw-token');
  assert.deepEqual(opts.mcp.calls, []);
  assert.deepEqual(opts.pw.calls, ['getAccessToken']);

  const status = client.getClientStatus();
  assert.equal(status.mode, 'playwright');
  assert.equal(client.getLastOutcome().fellBackFromWebpageMcp, false);
});

test('FallbackChatGPTClient prefers webpage-mcp when transport=webpage_mcp', async () => {
  const opts = makeOptions('webpage_mcp');
  const client = new FallbackChatGPTClient(opts);

  const token = await client.getAccessToken();
  assert.equal(token, 'mcp-token');
  assert.deepEqual(opts.mcp.calls, ['getAccessToken']);
  assert.deepEqual(opts.pw.calls, []);
  assert.equal(client.getLastOutcome().mode, 'webpage_mcp');
  assert.equal(client.getLastOutcome().fellBackFromWebpageMcp, false);
});

test('FallbackChatGPTClient falls back to Playwright if webpage-mcp fails', async () => {
  const opts = makeOptions('webpage_mcp', {
    throwAccessToken: new Error('extension-not-connected'),
  });
  const logged: string[] = [];
  const client = new FallbackChatGPTClient({
    ...opts,
    log: (msg) => logged.push(msg),
  });

  const token = await client.getAccessToken();
  assert.equal(token, 'pw-token');
  assert.deepEqual(opts.mcp.calls, ['getAccessToken']);
  assert.deepEqual(opts.pw.calls, ['getAccessToken']);

  const outcome = client.getLastOutcome();
  assert.equal(outcome.mode, 'playwright');
  assert.equal(outcome.fellBackFromWebpageMcp, true);
  assert.match(outcome.fallbackReason ?? '', /extension-not-connected/);
  assert.match(outcome.fallbackCooldownUntil ?? '', /^\d{4}-/);
  assert.match(
    client.getClientStatus().fallbackCooldownUntil ?? '',
    /^\d{4}-/,
  );
  assert.equal(logged.length, 1);
  assert.match(logged[0], /webpage-mcp transport failed/);
});

test('FallbackChatGPTClient.openLogin does not fall back from webpage-mcp to Playwright', async () => {
  const opts = makeOptions('webpage_mcp', {
    failOpen: true,
  });
  const client = new FallbackChatGPTClient(opts);

  await assert.rejects(client.openLogin(), /mcp-openLogin-failed/);
  assert.deepEqual(opts.mcp.calls, ['openLogin']);
  assert.deepEqual(opts.pw.calls, []);
  assert.equal(client.getLastOutcome().mode, 'webpage_mcp');
  assert.equal(client.getLastOutcome().fellBackFromWebpageMcp, false);
});

test('FallbackChatGPTClient.probeAuthStatus uses selected transport without fallback', async () => {
  const opts = makeOptions('webpage_mcp', {
    throwAccessToken: new Error('extension-not-connected'),
  });
  const client = new FallbackChatGPTClient(opts);

  assert.equal(await client.probeAuthStatus(), 'error');
  assert.deepEqual(opts.mcp.calls, ['getAccessToken']);
  assert.deepEqual(opts.pw.calls, []);
  assert.equal(client.getLastOutcome().mode, 'webpage_mcp');
});

test('FallbackChatGPTClient surfaces fallback reason if Playwright also fails', async () => {
  const opts = makeOptions(
    'webpage_mcp',
    { throwAccessToken: new Error('mcp-down') },
    { throwAccessToken: new Error('pw-down') },
  );
  const client = new FallbackChatGPTClient(opts);

  await assert.rejects(client.getAccessToken(), /pw-down/);
  const outcome = client.getLastOutcome();
  assert.equal(outcome.mode, 'playwright');
  assert.equal(outcome.fellBackFromWebpageMcp, true);
  assert.match(outcome.fallbackReason ?? '', /mcp-down/);
  assert.match(outcome.fallbackReason ?? '', /pw-down/);
  assert.match(outcome.fallbackCooldownUntil ?? '', /^\d{4}-/);
});

test('FallbackChatGPTClient keeps fallback reason and cooldown during cooldown', async () => {
  const opts = makeOptions('webpage_mcp', {
    throwAccessToken: new Error('mcp-error'),
  });
  const client = new FallbackChatGPTClient(opts);

  // First call: mcp fails → fallback to pw → enter cooldown
  await client.getAccessToken();
  assert.equal(opts.mcp.calls.length, 1);
  assert.equal(opts.pw.calls.length, 1);

  // Second call within cooldown: should go straight to pw, skipping mcp
  await client.getAccessToken();
  assert.equal(
    opts.mcp.calls.length,
    1,
    'mcp should not be called during cooldown',
  );
  assert.equal(opts.pw.calls.length, 2);
  const outcome = client.getLastOutcome();
  assert.equal(outcome.mode, 'playwright');
  assert.equal(outcome.fellBackFromWebpageMcp, true);
  assert.match(outcome.fallbackReason ?? '', /mcp-error/);
  assert.match(outcome.fallbackCooldownUntil ?? '', /^\d{4}-/);
  const status = client.getClientStatus();
  assert.equal(status.mode, 'playwright');
  assert.match(status.fallbackReason ?? '', /mcp-error/);
  assert.match(status.fallbackCooldownUntil ?? '', /^\d{4}-/);
});

test('FallbackChatGPTClient re-evaluates transport on every call', async () => {
  let transport: TransportMode = 'playwright';
  const mcp = makeClient('mcp');
  const pw = makeClient('pw');
  const client = new FallbackChatGPTClient({
    getTransport: () => transport,
    webpageMcpClient: mcp,
    playwrightClient: pw,
  });

  await client.getAccessToken();
  assert.equal(client.getLastOutcome().mode, 'playwright');

  transport = 'webpage_mcp';
  await client.getAccessToken();
  assert.equal(client.getLastOutcome().mode, 'webpage_mcp');

  transport = 'playwright';
  await client.getAccessToken();
  assert.equal(client.getLastOutcome().mode, 'playwright');
});

test('FallbackChatGPTClient.close closes both transports', async () => {
  const opts = makeOptions('playwright');
  const client = new FallbackChatGPTClient(opts);
  await client.close();
  assert.deepEqual(opts.mcp.calls, ['close']);
  assert.deepEqual(opts.pw.calls, ['close']);
});
