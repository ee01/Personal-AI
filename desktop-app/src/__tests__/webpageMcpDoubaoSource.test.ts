import assert from 'node:assert/strict';
import test from 'node:test';

import { WebpageMcpDoubaoSource } from '../explorer/sources/WebpageMcpDoubaoSource.js';
import type { WebpageMcpHost } from '../explorer/transports/WebpageMcpHost.js';

type ToolCall = { name: string; args: Record<string, unknown> };

function makeHost(options: {
  tabId?: number;
  evalResults?: Array<string | Error>;
  validateEvalSyntax?: boolean;
}) {
  const calls: ToolCall[] = [];
  const evalResults = [...(options.evalResults ?? [])];
  let currentTabId = options.tabId;

  const host = {
    start: async () => undefined,
    stop: async () => undefined,
    getStatus: () => ({ running: true, extensionConnected: true }),
    findTabByUrl: async () => currentTabId,
    evalInTab: async (_tabId: number | undefined, code: string) => {
      if (options.validateEvalSyntax) {
        new Function(`return ${code};`);
      }
      const result = evalResults.shift() ?? '';
      if (result instanceof Error) throw result;
      return result;
    },
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'chrome_navigate') {
        currentTabId ??= 123;
      }
      return { content: [{ type: 'text', text: '' }] };
    },
  } as unknown as WebpageMcpHost;

  return { host, calls };
}

test('webpage-mcp Doubao source reuses an existing Doubao tab for login', async () => {
  const { host, calls } = makeHost({ tabId: 456 });
  const source = new WebpageMcpDoubaoSource(host);

  assert.equal(await source.openLogin(), 'https://www.doubao.com/chat/');
  assert.deepEqual(calls, [
    {
      name: 'chrome_navigate',
      args: {
        url: 'https://www.doubao.com/chat/',
        tabId: 456,
      },
    },
  ]);
});

test('webpage-mcp Doubao source does not inspect the active tab when no Doubao tab exists', async () => {
  const { host, calls } = makeHost({ tabId: undefined });
  const source = new WebpageMcpDoubaoSource(host);

  assert.equal(await source.probeAuthStatus(), 'needs_login');
  assert.deepEqual(calls, []);
  await assert.rejects(
    () => source.collectConversationSnapshots(),
    /No existing doubao\.com tab found/,
  );
});

test('webpage-mcp Doubao source normalizes absolute DOM conversation URLs', async () => {
  const { host, calls } = makeHost({
    tabId: 789,
    validateEvalSyntax: true,
    evalResults: [
      JSON.stringify({ ok: false, error: 404 }),
      JSON.stringify({
        conversations: [
          {
            conversationId: 'thread-abc',
            title: 'Daily memory',
            updatedLabel: '今天 09:00',
            url: 'https://www.doubao.com/thread/thread-abc',
          },
        ],
      }),
      JSON.stringify([
        {
          roleHint: '我',
          content: '需要沉淀的一条豆包消息',
          timestampLabel: '今天 09:01',
        },
      ]),
    ],
  });
  const source = new WebpageMcpDoubaoSource(host);

  const snapshots = await source.collectConversationSnapshots();

  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], {
    conversationId: 'thread-abc',
    url: 'https://www.doubao.com/thread/thread-abc',
    title: 'Daily memory',
    updatedLabel: '今天 09:00',
    messages: [
      {
        roleHint: '我',
        content: '需要沉淀的一条豆包消息',
        timestampLabel: '今天 09:01',
      },
    ],
  });
  assert.deepEqual(
    calls.filter((call) => call.name === 'chrome_navigate'),
    [
      {
        name: 'chrome_navigate',
        args: {
          url: 'https://www.doubao.com/thread/thread-abc',
          tabId: 789,
        },
      },
    ],
  );
});

test('webpage-mcp Doubao source surfaces DOM fallback failures', async () => {
  const { host } = makeHost({
    tabId: 789,
    evalResults: [
      JSON.stringify({ ok: false, error: 404 }),
      JSON.stringify({
        conversations: [],
        error: 'document query failed',
      }),
    ],
  });
  const source = new WebpageMcpDoubaoSource(host);

  await assert.rejects(
    () => source.collectConversationSnapshots(),
    /Doubao DOM fallback failed: document query failed/,
  );
});
