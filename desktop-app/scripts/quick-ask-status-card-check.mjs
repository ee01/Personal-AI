import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, '../app');

const runtimeSummary = {
  pendingConfirmCount: 0,
  queuedActionCount: 0,
  runningActionCount: 0,
  waitingReplyCount: 0,
  pendingApprovalCount: 2,
  escalatedCount: 0,
  memoryGrowth: {
    windowDays: 90,
    recentMessageCount: 120,
    lowMessageThreshold: 50,
    belowThreshold: false,
  },
  topStatus: {
    kind: 'waiting_reply',
    label: '外部询问待批准发送',
    count: 2,
    priority: 5,
  },
  items: [
    {
      kind: 'waiting_reply',
      title: '外部询问待批准发送',
      summary: '是否向 Chris 追问发布窗口？',
      detailLines: ['待你确认发送：2'],
      count: 2,
      badgeLabel: '待发 2',
      actionHint: '查看待发内容',
      priority: 5,
    },
  ],
  fetchedAt: '2026-05-21T00:00:00.000Z',
};

async function main() {
  const { server, url } = await serveQuickAskApp();
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });

  await page.addInitScript((summary) => {
    window.__openedSettings = 0;
    window.__quickAskHandlers = {};
    window.bridgeApi = {
      getSettings: async () => ({
        effective: {
          explorer: {
            askDefaultScope: 'work',
          },
        },
      }),
      updateSettings: async (payload) => ({
        effective: {
          explorer: {
            askDefaultScope: payload?.explorer?.askDefaultScope || 'work',
          },
        },
      }),
    };
    window.explorerApi = {
      getStatus: async () => ({ askDefaultScope: 'work' }),
    };
    window.appShell = {
      openExternal: async (url) => {
        window.__lastExternalUrl = url;
      },
    };
    window.quickAsk = {
      askStream: async () => undefined,
      remember: async () => ({ items: [] }),
      getRuntimeSummary: async () => summary,
      setLayout: async () => ({ ok: true }),
      hide: async () => undefined,
      openSettings: async () => {
        window.__openedSettings += 1;
      },
      openFullBridge: async () => undefined,
      newSession: async () => undefined,
      getPreferences: async () => ({ voiceLocale: 'zh-CN' }),
      startNativeVoice: async () => undefined,
      stopNativeVoice: async () => undefined,
      cancelNativeVoice: async () => undefined,
      resolveShortcutGesture: async () => undefined,
      log: async () => undefined,
      onNativeShortcutEvent: (callback) => {
        window.__quickAskHandlers.nativeShortcut = callback;
      },
      onVoiceEvent: (callback) => {
        window.__quickAskHandlers.voice = callback;
      },
      onShortcutStatus: (callback) => {
        window.__quickAskHandlers.shortcutStatus = callback;
      },
      onResetSession: (callback) => {
        window.__quickAskHandlers.resetSession = callback;
      },
      onWindowShown: (callback) => {
        window.__quickAskHandlers.windowShown = callback;
      },
      onPrepareHide: (callback) => {
        window.__quickAskHandlers.prepareHide = callback;
      },
      onFocusInput: (callback) => {
        window.__quickAskHandlers.focusInput = callback;
      },
    };
  }, runtimeSummary);

  try {
    await page.goto(url);

    const statusPill = page.locator('#status-pill');
    await statusPill.waitFor({ state: 'visible' });
    await assertText(statusPill, '外部询问待批准发送');

    await statusPill.click();
    const statusItem = page.locator('.status-item').first();
    await statusItem.waitFor({ state: 'visible' });
    await assertText(page.locator('.status-item-title').first(), '外部询问待批准发送');
    await assertText(page.locator('.status-item-summary').first(), '是否向 Chris 追问发布窗口？');
    await assertText(page.locator('.status-item-details').first(), '待你确认发送：2');
    await assertText(page.locator('.status-item-hint').first(), '查看待发内容');

    await statusItem.click();
    const draft = await page.locator('#composer').inputValue();
    assert.match(draft, /关于「外部询问待批准发送」/);
    assert.match(draft, /是否向 Chris 追问发布窗口/);
    assert.match(draft, /帮我总结这些外部询问状态/);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function serveQuickAskApp() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const pathname =
        requestUrl.pathname === '/' ? '/quick-ask.html' : requestUrl.pathname;
      const filePath = resolve(appDir, `.${decodeURIComponent(pathname)}`);
      if (!filePath.startsWith(`${appDir}/`) && filePath !== appDir) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        'content-type': contentTypeFor(filePath),
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(404);
      response.end(error instanceof Error ? error.message : 'Not found');
    }
  });

  await new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    server,
    url: `http://127.0.0.1:${address.port}/quick-ask.html`,
  };
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function assertText(locator, expected) {
  const text = (await locator.textContent())?.replace(/\s+/g, ' ').trim();
  assert.equal(text, expected);
}

await main();
