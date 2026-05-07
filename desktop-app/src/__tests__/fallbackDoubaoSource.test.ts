import assert from 'node:assert/strict';
import test from 'node:test';

import type { BrowserConversationSnapshot } from '../browserSession.js';
import type { DoubaoConversationCollectorClient } from '../explorer/sources/DoubaoChatSource.js';
import { FallbackDoubaoSource } from '../explorer/sources/FallbackDoubaoSource.js';

type MethodName = 'openLogin' | 'collectConversationSnapshots';

function createClient(
  name: string,
  options: { failMethods?: MethodName[] } = {},
): DoubaoConversationCollectorClient & { calls: MethodName[] } {
  const calls: MethodName[] = [];
  const shouldFail = (method: MethodName) =>
    options.failMethods?.includes(method);

  return {
    calls,
    async openLogin() {
      calls.push('openLogin');
      if (shouldFail('openLogin')) throw new Error(`${name} open failed`);
      return `https://www.doubao.com/chat/${name}`;
    },
    async probeAuthStatus() {
      return 'connected';
    },
    async collectConversationSnapshots(): Promise<BrowserConversationSnapshot[]> {
      calls.push('collectConversationSnapshots');
      if (shouldFail('collectConversationSnapshots')) {
        throw new Error(`${name} collect failed`);
      }
      return [
        {
          conversationId: name,
          title: name,
          messages: [{ content: `${name} message` }],
        },
      ];
    },
  };
}

test('FallbackDoubaoSource falls back to managed Chromium when webpage-mcp read fails', async () => {
  const webpageMcp = createClient('webpage_mcp', {
    failMethods: ['collectConversationSnapshots'],
  });
  const playwright = createClient('playwright');
  const source = new FallbackDoubaoSource({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  const first = await source.collectConversationSnapshots();
  const second = await source.collectConversationSnapshots();

  assert.equal(first[0]?.conversationId, 'playwright');
  assert.equal(second[0]?.conversationId, 'playwright');
  assert.deepEqual(source.getClientStatus(), {
    mode: 'playwright',
    fallbackReason: 'webpage_mcp collect failed',
  });
  assert.deepEqual(webpageMcp.calls, ['collectConversationSnapshots']);
  assert.deepEqual(playwright.calls, [
    'collectConversationSnapshots',
    'collectConversationSnapshots',
  ]);
});

test('FallbackDoubaoSource uses webpage-mcp when selected and healthy', async () => {
  const webpageMcp = createClient('webpage_mcp');
  const playwright = createClient('playwright');
  const source = new FallbackDoubaoSource({
    getTransport: () => 'webpage_mcp',
    webpageMcpClient: webpageMcp,
    playwrightClient: playwright,
  });

  assert.equal(await source.openLogin(), 'https://www.doubao.com/chat/webpage_mcp');
  assert.deepEqual(source.getClientStatus(), {
    mode: 'webpage_mcp',
    fallbackReason: undefined,
  });
  assert.deepEqual(webpageMcp.calls, ['openLogin']);
  assert.deepEqual(playwright.calls, []);
});
