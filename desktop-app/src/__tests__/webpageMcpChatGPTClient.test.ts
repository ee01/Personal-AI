import assert from 'node:assert/strict';
import test from 'node:test';

import type { WebpageMcpHost } from '../explorer/transports/WebpageMcpHost.js';
import { WebpageMcpChatGPTClient } from '../explorer/sources/WebpageMcpChatGPTClient.js';

type MockResult = { content?: Array<{ type: string; text?: string }> };

/**
 * Build a minimal mock of WebpageMcpHost for testing WebpageMcpChatGPTClient.
 * We intercept evalInTab() to return the pre-seeded JS result string directly,
 * and findTabByUrl() always returns undefined (active tab).
 */
function makeMockHost(
  jsResults: Record<string, string>,
  options?: { tabId?: number },
): WebpageMcpHost {
  const callTool = async (name: string, _args: Record<string, unknown>): Promise<MockResult> => {
    const toolKey = Object.keys(jsResults).find((k) => k === name);
    if (toolKey !== undefined) {
      return { content: [{ type: 'text', text: jsResults[toolKey] }] };
    }
    return { content: [{ type: 'text', text: '' }] };
  };

  return {
    callTool,
    findTabByUrl: async () => options?.tabId,
    evalInTab: async (_tabId: number | undefined, _code: string): Promise<string> => {
      const result = await callTool('chrome_javascript', {});
      return result?.content?.find((c) => c.type === 'text')?.text ?? '';
    },
    start: async () => {},
    stop: async () => {},
    getStatus: () => ({ running: true, extensionConnected: true }),
  } as unknown as WebpageMcpHost;
}

function textResult(text: string): string {
  return text;
}

test('WebpageMcpChatGPTClient.getClientStatus returns webpage_mcp mode', () => {
  const host = makeMockHost({}, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  assert.equal(client.getClientStatus().mode, 'webpage_mcp');
});

test('WebpageMcpChatGPTClient.getAccessToken parses session response', async () => {
  const sessionBody = JSON.stringify({
    ok: true,
    status: 200,
    body: { accessToken: 'tok-abc' },
  });
  const host = makeMockHost({
    chrome_javascript: textResult(sessionBody),
  }, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  const token = await client.getAccessToken();
  assert.equal(token, 'tok-abc');
});

test('WebpageMcpChatGPTClient.getAccessToken returns undefined when session has no token', async () => {
  const sessionBody = JSON.stringify({
    ok: true,
    status: 200,
    body: {},
  });
  const host = makeMockHost({
    chrome_javascript: textResult(sessionBody),
  }, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  const token = await client.getAccessToken();
  assert.equal(token, undefined);
});

test('WebpageMcpChatGPTClient.openLogin opens daily Chrome tab through webpage-mcp', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const host = {
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { content: [{ type: 'text', text: '' }] };
    },
    findTabByUrl: async () => undefined,
    evalInTab: async () => '',
    start: async () => {},
    stop: async () => {},
    getStatus: () => ({ running: true, extensionConnected: true }),
  } as unknown as WebpageMcpHost;
  const client = new WebpageMcpChatGPTClient(host);

  assert.equal(await client.openLogin(), 'https://chatgpt.com/auth/login');
  assert.deepEqual(calls, [
    {
      name: 'chrome_navigate',
      args: {
        url: 'https://chatgpt.com/auth/login',
        openMode: 'new_tab',
      },
    },
  ]);
});

test('WebpageMcpChatGPTClient.listConversationsPage parses items array', async () => {
  const listBody = JSON.stringify({
    ok: true,
    status: 200,
    body: {
      items: [
        { id: 'c1', title: 'Test Conv', update_time: '1700000000' },
      ],
    },
  });
  const host = makeMockHost({ chrome_javascript: textResult(listBody) }, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  const items = await client.listConversationsPage('tok', 0, 100);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.id, 'c1');
});

test('WebpageMcpChatGPTClient.listConversationsPage throws on API error', async () => {
  const errBody = JSON.stringify({ ok: false, status: 401, body: null, errorText: 'Unauthorized' });
  const host = makeMockHost({ chrome_javascript: textResult(errBody) }, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  await assert.rejects(
    () => client.listConversationsPage('tok', 0, 100),
    /ChatGPT.*401/,
  );
});

test('WebpageMcpChatGPTClient.close resolves without error', async () => {
  const host = makeMockHost({}, { tabId: 123 });
  const client = new WebpageMcpChatGPTClient(host);
  await assert.doesNotReject(() => client.close());
});

test('WebpageMcpChatGPTClient.getAccessToken throws when no chatgpt tab exists', async () => {
  const host = makeMockHost({});
  const client = new WebpageMcpChatGPTClient(host);
  await assert.rejects(
    () => client.getAccessToken(),
    /No existing chatgpt\.com tab found/,
  );
});
