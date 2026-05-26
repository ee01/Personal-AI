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

  try {
    const page = await setupQuickAskPage(browser, url, runtimeSummary);

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
    assert.match(draft, /待你确认发送：2/);
    assert.match(draft, /查看待发内容/);
    assert.match(draft, /帮我总结这些外部询问状态/);

    const runtimeIssuePage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      pendingApprovalCount: 0,
      topStatus: {
        kind: 'runtime_issue',
        label: '状态读取异常',
        count: 1,
        priority: 2,
      },
      items: [
        {
          kind: 'runtime_issue',
          title: '状态读取异常',
          summary:
            '读取 Memory Service 运行态失败：connect ECONNREFUSED 127.0.0.1:3210',
          detailLines: [
            'Quick Ask 仍可保留本地会话；状态数据会在服务恢复后刷新。',
            '这不是同步已完成或用户配置未完成的信号。',
          ],
          count: 1,
          badgeLabel: '需重试',
          actionHint: '测试 Memory Service',
          priority: 2,
        },
      ],
    });
    await runtimeIssuePage.locator('#status-pill').click();
    const runtimeStatusItem = runtimeIssuePage.locator('.status-item').first();
    await runtimeStatusItem.waitFor({ state: 'visible' });
    await assertText(
      runtimeIssuePage.locator('.status-item-title').first(),
      '状态读取异常',
    );
    await assertText(
      runtimeIssuePage.locator('.status-item-hint').first(),
      '测试 Memory Service',
    );

    await runtimeStatusItem.click();
    const runtimeDraft = await runtimeIssuePage.locator('#composer').inputValue();
    assert.match(runtimeDraft, /关于「状态读取异常」/);
    assert.match(runtimeDraft, /ECONNREFUSED/);
    assert.match(runtimeDraft, /不是同步已完成/);
    assert.match(runtimeDraft, /测试 Memory Service/);

    const sessionStart = Date.parse('2026-05-25T09:00:00.000Z');
    const sessionPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      now: sessionStart,
      askStreamEvents: [
        {
          type: 'result',
          answer: '第一轮答案',
          evidence: [
            {
              type: 'message',
              source: 'manual',
              content: '本周发布优先级来自真实记忆证据。',
              metadata: {
                sender: 'Esone',
                groupName: 'planning',
              },
            },
          ],
          runtime: { items: [] },
        },
      ],
    });

    await sessionPage.locator('#composer').fill('第一件事是什么');
    await sessionPage.keyboard.press('Enter');
    await sessionPage.waitForFunction(
      () => window.__lastAskPayload?.query === '第一件事是什么',
    );
    await sessionPage.waitForFunction(() =>
      document.body.textContent?.includes('第一轮答案'),
    );
    await assertText(
      sessionPage.locator('.role-assistant').last().locator('p').first(),
      '第一轮答案',
    );
    const mobileSyncButton = sessionPage.locator(
      '.quick-ask-sync-mobile',
    );
    await mobileSyncButton.waitFor({ state: 'visible' });
    await assertText(mobileSyncButton, '发到豆包手机对话');
    await assertText(
      sessionPage.locator('.message-action-status').first(),
      '带证据发送，不写长期记忆',
    );

    await mobileSyncButton.click();
    await sessionPage.waitForFunction(
      () => window.__lastInjectPayload?.answer === '第一轮答案',
    );
    const injectPayload = await sessionPage.evaluate(
      () => window.__lastInjectPayload,
    );
    assert.equal(injectPayload.query, '第一件事是什么');
    assert.equal(injectPayload.evidence.length, 1);
    assert.equal(injectPayload.evidence[0].source, 'manual');
    assert.match(injectPayload.evidence[0].title, /Esone/);
    assert.match(injectPayload.evidence[0].snippet, /真实记忆证据/);
    await assertText(
      sessionPage.locator('.message-action-status').first(),
      '已发送到豆包手机对话',
    );

    await sessionPage.evaluate(() => {
      window.__quickAskNow += 31 * 60 * 1000;
      window.__quickAskHandlers.prepareHide?.();
      window.__quickAskHandlers.windowShown?.({ focusInput: false });
    });

    assert.equal(
      await sessionPage.locator('#quick-ask-shell').getAttribute('data-state'),
      'idle-compact',
    );
    assert.equal(await sessionPage.locator('.message-card').count(), 0);

    await sessionPage.locator('#composer').fill('第二件事是什么');
    await sessionPage.keyboard.press('Enter');
    await sessionPage.waitForFunction(
      () => window.__lastAskPayload?.query === '第二件事是什么',
    );
    const secondAskContext = await sessionPage.evaluate(
      () => window.__lastAskPayload?.context || '',
    );
    assert.equal(secondAskContext.includes('第一件事是什么'), false);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function setupQuickAskPage(browser, url, summary, options = {}) {
  const page = await browser.newPage({ viewport: { width: 520, height: 820 } });

  await page.addInitScript(({ runtime, testOptions }) => {
    const realDateNow = Date.now.bind(Date);
    window.__quickAskNow =
      typeof testOptions.now === 'number' ? testOptions.now : realDateNow();
    Date.now = () => window.__quickAskNow;
    window.__openedSettings = 0;
    window.__lastAskPayload = null;
    window.__lastInjectPayload = null;
    window.__quickAskHandlers = {};
    const askStreamEvents = Array.isArray(testOptions.askStreamEvents)
      ? testOptions.askStreamEvents
      : [];
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
      askStream: async (payload, onEvent) => {
        window.__lastAskPayload = payload;
        for (const event of askStreamEvents) {
          await onEvent(event);
        }
      },
      injectQuery: async (payload) => {
        window.__lastInjectPayload = payload;
        return testOptions.injectResult || { accepted: true };
      },
      remember: async () => ({ items: [] }),
      getRuntimeSummary: async () => runtime,
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
  }, { runtime: summary, testOptions: options });

  await page.goto(url);
  return page;
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
