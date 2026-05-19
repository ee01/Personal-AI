import assert from 'node:assert/strict';
import test from 'node:test';

import { WebpageMcpDoubaoBroadcast } from '../transports/WebpageMcpDoubaoBroadcast.js';
import type { WebpageMcpHost } from '../explorer/transports/WebpageMcpHost.js';

type ToolCall = { name: string; args: Record<string, unknown> };

function makeHost(options: {
  hasInitialTab?: boolean;
  fillSucceeds?: boolean;
  keyboardSucceeds?: boolean;
  clickSucceeds?: boolean;
  messageVisibleAfterSubmit?: boolean;
  finalUrl?: string;
  bodyText?: string;
  bodyTextSequence?: string[];
}) {
  const calls: ToolCall[] = [];
  let currentUrl = options.hasInitialTab
    ? (options.finalUrl ?? 'https://www.doubao.com/chat/existing-thread')
    : '';
  let bodyText = options.bodyText ?? '';
  let bodyReadIndex = 0;
  let lastFilledText = '';

  const host = {
    start: async () => undefined,
    stop: async () => undefined,
    getStatus: () => ({ running: true, extensionConnected: true }),
    findTabByUrl: async () =>
      currentUrl.includes('doubao.com') ? 123 : undefined,
    evalInTab: async (_tabId: number | undefined, code: string) => {
      if (code.includes('window.location.href')) return currentUrl;
      if (code.includes('document.title')) return 'Doubao test thread';
      if (code.includes('document.body')) {
        const sequenced = options.bodyTextSequence?.[bodyReadIndex];
        bodyReadIndex += 1;
        return sequenced ?? bodyText;
      }
      return '';
    },
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'chrome_navigate') {
        currentUrl = String(args.url || '');
        return { content: [{ type: 'text', text: '' }] };
      }
      if (name === 'chrome_fill_or_select') {
        if (!options.fillSucceeds) throw new Error('selector not found');
        lastFilledText = String(args.value || '');
        return { content: [{ type: 'text', text: '' }] };
      }
      if (name === 'chrome_keyboard') {
        if (!options.keyboardSucceeds) throw new Error('keyboard failed');
        currentUrl =
          options.finalUrl ?? 'https://www.doubao.com/chat/generated-alpha_1';
        if (options.messageVisibleAfterSubmit) bodyText = lastFilledText;
        return { content: [{ type: 'text', text: '' }] };
      }
      if (name === 'chrome_click_element') {
        if (!options.clickSucceeds) throw new Error('click failed');
        currentUrl =
          options.finalUrl ?? 'https://www.doubao.com/thread/generated-alpha_1';
        if (options.messageVisibleAfterSubmit) bodyText = lastFilledText;
        return { content: [{ type: 'text', text: '' }] };
      }
      return { content: [{ type: 'text', text: '' }] };
    },
  } as unknown as WebpageMcpHost;

  return { host, calls };
}

function createBroadcast(host: WebpageMcpHost) {
  const broadcast = new WebpageMcpDoubaoBroadcast(host);
  (broadcast as unknown as Record<string, (ms: number) => Promise<void>>).wait =
    async () => undefined;
  return broadcast;
}

test('webpage-mcp Doubao broadcast opens a Doubao tab and verifies visible sent text', async () => {
  const { host, calls } = makeHost({
    hasInitialTab: false,
    fillSucceeds: true,
    keyboardSucceeds: true,
    messageVisibleAfterSubmit: true,
    finalUrl: 'https://www.doubao.com/chat/generated-alpha_1',
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('请把这条测试内容存入随手记');

  assert.equal(result.sent, true);
  assert.equal(result.verified, true);
  assert.equal(result.threadId, 'generated-alpha_1');
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.equal(result.error, undefined);
  assert.deepEqual(calls[0], {
    name: 'chrome_navigate',
    args: {
      url: 'https://www.doubao.com/chat/',
      openMode: 'new_tab',
    },
  });
});

test('webpage-mcp Doubao broadcast does not submit when no composer can be filled', async () => {
  const { host, calls } = makeHost({
    hasInitialTab: true,
    fillSucceeds: false,
    keyboardSucceeds: true,
    messageVisibleAfterSubmit: true,
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('不会被填入的内容');

  assert.equal(result.sent, false);
  assert.equal(result.verified, false);
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.equal(result.messageVisible, false);
  assert.match(result.error || '', /No editable element/);
  assert.equal(calls.some((call) => call.name === 'chrome_keyboard'), false);
});

test('webpage-mcp Doubao broadcast reports failure when submitted text is not visible', async () => {
  const { host } = makeHost({
    hasInitialTab: true,
    fillSucceeds: true,
    keyboardSucceeds: true,
    messageVisibleAfterSubmit: false,
    finalUrl: 'https://www.doubao.com/thread/team-memory-42',
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('页面里最终看不到的内容');

  assert.equal(result.sent, false);
  assert.equal(result.verified, false);
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.equal(result.threadId, 'team-memory-42');
  assert.match(result.error || '', /did not show the message/);
});

test('webpage-mcp Doubao broadcast waits until submitted text becomes visible', async () => {
  const { host } = makeHost({
    hasInitialTab: true,
    fillSucceeds: true,
    keyboardSucceeds: true,
    messageVisibleAfterSubmit: false,
    finalUrl: 'https://www.doubao.com/chat/slow-thread',
    bodyTextSequence: ['', '', '延迟出现的消息内容'],
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('延迟出现的消息内容');

  assert.equal(result.sent, true);
  assert.equal(result.verified, true);
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.equal(result.threadId, 'slow-thread');
});

test('webpage-mcp Doubao broadcast does not type into a challenge page', async () => {
  const { host, calls } = makeHost({
    hasInitialTab: true,
    fillSucceeds: true,
    keyboardSucceeds: true,
    bodyText: '请完成安全验证后继续使用',
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('不应填入安全验证页');

  assert.equal(result.sent, false);
  assert.equal(result.verified, false);
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.equal(result.challengeDetected, true);
  assert.match(result.error || '', /challenge detected before send/i);
  assert.equal(calls.some((call) => call.name === 'chrome_fill_or_select'), false);
  assert.equal(calls.some((call) => call.name === 'chrome_keyboard'), false);
});

test('webpage-mcp Doubao broadcast falls back to send button when keyboard submit fails', async () => {
  const { host, calls } = makeHost({
    hasInitialTab: true,
    fillSucceeds: true,
    keyboardSucceeds: false,
    clickSucceeds: true,
    messageVisibleAfterSubmit: true,
    finalUrl: 'https://www.doubao.com/thread/mobile-context_xyz',
  });
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('按钮发送路径内容');

  assert.equal(result.sent, true);
  assert.equal(result.threadId, 'mobile-context_xyz');
  assert.equal(calls.some((call) => call.name === 'chrome_keyboard'), true);
  assert.equal(
    calls.some((call) => call.name === 'chrome_click_element'),
    true,
  );
});

test('webpage-mcp Doubao broadcast does not inspect active tab for auth without a Doubao tab', async () => {
  let evalCalls = 0;
  const host = {
    start: async () => undefined,
    stop: async () => undefined,
    getStatus: () => ({ running: true, extensionConnected: true }),
    findTabByUrl: async () => undefined,
    evalInTab: async () => {
      evalCalls += 1;
      return JSON.stringify({ loggedIn: true });
    },
    callTool: async () => ({ content: [{ type: 'text', text: '' }] }),
  } as unknown as WebpageMcpHost;
  const broadcast = createBroadcast(host);

  assert.equal(await broadcast.probeAuthStatus(), 'needs_login');
  assert.equal(evalCalls, 0);
});

test('webpage-mcp Doubao broadcast refuses to send when navigation leaves no Doubao tab', async () => {
  const calls: ToolCall[] = [];
  let evalCalls = 0;
  const host = {
    start: async () => undefined,
    stop: async () => undefined,
    getStatus: () => ({ running: true, extensionConnected: true }),
    findTabByUrl: async () => undefined,
    evalInTab: async () => {
      evalCalls += 1;
      return '';
    },
    callTool: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { content: [{ type: 'text', text: '' }] };
    },
  } as unknown as WebpageMcpHost;
  const broadcast = createBroadcast(host);

  const result = await broadcast.sendTranscript('不应进入当前活动页');

  assert.equal(result.sent, false);
  assert.equal(result.verified, false);
  assert.equal(result.transportMode, 'webpage_mcp');
  assert.match(result.error || '', /No doubao\.com tab/);
  assert.equal(evalCalls, 0);
  assert.equal(calls.some((call) => call.name === 'chrome_fill_or_select'), false);
  assert.equal(calls.some((call) => call.name === 'chrome_keyboard'), false);
});
