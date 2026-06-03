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
    const refreshedRuntimeSummary = {
      ...runtimeSummary,
      pendingConfirmCount: 1,
      pendingApprovalCount: 0,
      topStatus: {
        kind: 'confirm_request',
        label: '待你确认',
        count: 1,
        priority: 4,
      },
      items: [
        {
          kind: 'confirm_request',
          title: '待你确认',
          summary: '是否记录新的回复偏好？',
          detailLines: ['来自用户画像确认请求'],
          count: 1,
          badgeLabel: '1 条',
          actionHint: '继续追问这条状态',
          priority: 4,
        },
      ],
      fetchedAt: '2026-05-21T00:01:30.000Z',
    };
    const page = await setupQuickAskPage(browser, url, runtimeSummary, {
      now: Date.parse('2026-05-21T00:02:00.000Z'),
      runtimeSequence: [runtimeSummary, refreshedRuntimeSummary],
    });

    const statusPill = page.locator('#status-pill');
    await statusPill.waitFor({ state: 'visible' });
    await assertText(statusPill, '外部询问待批准发送');

    await statusPill.click();
    const statusItem = page.locator('.status-item').first();
    await statusItem.waitFor({ state: 'visible' });
    await assertText(page.locator('.status-card-meta').first(), '快照：2 分钟前 · 1 项状态');
    await assertText(page.locator('.status-item-source').first(), 'Outreach 运行态');
    await assertText(page.locator('.status-item-title').first(), '外部询问待批准发送');
    await assertText(page.locator('.status-item-summary').first(), '是否向 Chris 追问发布窗口？');
    await assertText(page.locator('.status-item-details').first(), '待你确认发送：2');
    await assertText(page.locator('.status-item-hint').first(), '查看待发内容');

    await page.locator('.status-card-refresh').first().click();
    await assertText(page.locator('.status-refresh-note').first(), '已重新读取状态快照。');
    await assertText(page.locator('.status-card-meta').first(), '快照：刚刚刷新 · 1 项状态');
    await assertText(page.locator('.status-item-source').first(), 'Memory Service 确认请求');
    await assertText(page.locator('.status-item-title').first(), '待你确认');
    await assertText(page.locator('.status-item-summary').first(), '是否记录新的回复偏好？');

    await statusPill.click();
    await assertText(page.locator('.status-item-title').first(), '待你确认');
    assert.equal(await page.locator('.role-status').count(), 1);

    await statusItem.click();
    const draft = await page.locator('#composer').inputValue();
    assert.match(draft, /关于「待你确认」/);
    assert.match(draft, /是否记录新的回复偏好/);
    assert.match(draft, /来自用户画像确认请求/);
    assert.match(draft, /继续追问这条状态/);
    assert.match(draft, /帮我总结这些待确认项/);

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

    const repeatedRuntimePage = await setupQuickAskPage(
      browser,
      url,
      runtimeSummary,
      {
        askStreamEvents: [
          {
            type: 'result',
            answer: '带运行态的答案',
            evidence: [],
            runtime: runtimeSummary,
          },
        ],
      },
    );
    await repeatedRuntimePage.locator('#composer').fill('第一轮运行态');
    await repeatedRuntimePage.keyboard.press('Enter');
    await repeatedRuntimePage.waitForFunction(
      () => window.__lastAskPayload?.query === '第一轮运行态',
    );
    await repeatedRuntimePage.waitForFunction(() =>
      document.body.textContent?.includes('带运行态的答案'),
    );
    assert.equal(await repeatedRuntimePage.locator('.role-status').count(), 1);
    assert.deepEqual(await currentSessionRowRoles(repeatedRuntimePage), [
      'role-status',
      'role-user',
      'role-assistant',
    ]);

    await repeatedRuntimePage.locator('#composer').fill('第二轮运行态');
    await repeatedRuntimePage.keyboard.press('Enter');
    await repeatedRuntimePage.waitForFunction(
      () => window.__lastAskPayload?.query === '第二轮运行态',
    );
    await repeatedRuntimePage.waitForFunction(
      () => document.querySelectorAll('.role-assistant').length === 2,
    );
    assert.equal(await repeatedRuntimePage.locator('.role-status').count(), 1);
    assert.deepEqual(await currentSessionRowRoles(repeatedRuntimePage), [
      'role-status',
      'role-user',
      'role-assistant',
      'role-user',
      'role-assistant',
    ]);

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
      window.__quickAskHandlers.prepareHide?.();
      window.__quickAskHandlers.windowShown?.({ focusInput: false });
    });
    assert.equal(
      await sessionPage.locator('#quick-ask-shell').getAttribute('data-state'),
      'enriched',
    );
    await assertText(
      sessionPage.locator('.role-assistant').last().locator('p').first(),
      '第一轮答案',
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

    const contextPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      activeBrowserContext: {
        available: true,
        title: 'RingCentral',
        url: 'https://app.ringcentral.com/messages/153798238214',
        visibleText:
          'MTR-141852: AI Custom VBG Members Quintin Xiao AI Generate 现在我们需要等RCV BE新的design 那个 BE ready 了吗？',
      },
      askStreamEvents: [
        {
          type: 'result',
          answer: 'BE 还没有 ready。',
          evidence: [
            {
              type: 'message',
              source: 'web',
              score: 0.99,
              content:
                '# Story Points estimation by AI Service - Google Docs Summary: CloseLearn moreJoin chat Restore this version Ask Gemini FileEditViewInsertFormatToolsGeminiExtensions Page setup Print preview Create a new doc '.repeat(8),
              metadata: {
                sender: 'Memory Capture',
                sourceTitle:
                  'Story Points estimation by AI Service - Google Docs',
                sourceUrl: 'https://docs.google.com/document/d/noisy/edit',
                captureLayer: 'memory_capture',
                channels: ['context_anchor'],
              },
            },
            {
              type: 'message',
              source: 'glip',
              score: 0.93,
              content:
                "<a class='at_mention_compose' rel='{\"id\":\"1485058842627\"}'>@Natalia Atanasii</a> wrote:\nWang > There is an initiative to replace VCG (RCV BE component) with new Istio gateway [INIT-26199](https://jira.ringcentral.com/browse/INIT-26199).\nAI Generate 现在我们需要等RCV BE新的design，所以 BE 还没有 ready。",
              metadata: {
                sourceTitle: 'MTR-141852: AI Custom VBG',
                sender: 'Quintin Xiao',
                groupName: 'MTR-141852: AI Custom VBG',
                channels: ['context_anchor'],
                implicitBackendContext: true,
              },
            },
          ],
          runtime: { items: [] },
        },
      ],
    });
    await contextPage.locator('#composer').fill('那个 BE ready 了吗？');
    await contextPage.keyboard.press('Enter');
    await contextPage.waitForFunction(
      () => window.__lastAskPayload?.query === '那个 BE ready 了吗？',
    );
    const activeAskContext = await contextPage.evaluate(
      () => window.__lastAskPayload?.context || '',
    );
    assert.match(activeAskContext, /Surface: RingCentral chat/);
    assert.match(activeAskContext, /Current chat title: MTR-141852: AI Custom VBG/);

    const firstEvidence = contextPage.locator('.evidence-item').first();
    await firstEvidence.waitFor({ state: 'visible' });
    await assertText(
      firstEvidence.locator('.evidence-source'),
      '网页',
    );
    await assertText(
      firstEvidence.locator('.evidence-meta-row span').last(),
      '弱相关网页快照',
    );
    assert.equal(
      await firstEvidence.locator('.evidence-raw[open]').count(),
      0,
    );
    const evidenceBox = await firstEvidence.boundingBox();
    assert.ok(
      evidenceBox && evidenceBox.height < 190,
      `noisy evidence card should stay compact, got ${evidenceBox?.height}`,
    );
    await contextPage
      .locator('.evidence-item')
      .nth(1)
      .locator('.evidence-head')
      .filter({ hasText: 'MTR-141852: AI Custom VBG' })
      .waitFor({ state: 'visible' });
    await contextPage
      .locator('.evidence-item')
      .nth(1)
      .locator('.evidence-raw summary')
      .click();
    const rawBody = contextPage
      .locator('.evidence-item')
      .nth(1)
      .locator('.evidence-raw-body');
    await rawBody.locator('a[data-external-link]').first().waitFor({
      state: 'visible',
    });
    const rawText = await rawBody.textContent();
    assert.match(rawText || '', /@Natalia Atanasii wrote:/);
    assert.doesNotMatch(rawText || '', /<a class=/);
    const evidenceOverflow = await contextPage.evaluate(() => {
      const panel = document.querySelector('#conversation-panel');
      return Boolean(panel && panel.scrollWidth > panel.clientWidth + 1);
    });
    assert.equal(evidenceOverflow, false);

    const docsContextPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      activeBrowserContext: {
        available: true,
        title: 'Story Points estimation by AI Service - Google Docs',
        url: 'https://docs.google.com/document/d/noisy/edit',
        visibleText:
          'Story Points estimation by AI Service Ask Gemini Restore this version',
      },
      askStreamEvents: [
        {
          type: 'result',
          answer: '上下文不足。',
          evidence: [],
          runtime: { items: [] },
        },
      ],
    });
    await docsContextPage.locator('#composer').fill('那个 BE ready 了吗？');
    await docsContextPage.keyboard.press('Enter');
    await docsContextPage.waitForFunction(
      () => window.__lastAskPayload?.query === '那个 BE ready 了吗？',
    );
    const skippedDocsContext = await docsContextPage.evaluate(
      () => window.__lastAskPayload?.context || '',
    );
    assert.equal(skippedDocsContext.includes('docs.google.com'), false);

    const voicePage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    });
    await voicePage.locator('#voice-button').click();
    await voicePage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-listening',
    );
    await voicePage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'error',
        code: 'speech_denied',
        message: 'Speech Recognition permission is required',
        speechStatus: 'denied',
      });
    });
    await assertText(
      voicePage.locator('#voice-transcript'),
      '请先在系统设置中允许语音识别权限。',
    );
    await assertText(voicePage.locator('#voice-recovery'), '打开语音识别设置');
    await voicePage.locator('#voice-recovery').click();
    await voicePage.waitForFunction(() => window.__openedSpeechSettings === 1);

    await voicePage.evaluate(() => {
      window.__voiceStartError = 'Speech helper is not running';
    });
    await voicePage.locator('#voice-orb').click();
    await voicePage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-ready',
    );
    await assertText(
      voicePage.locator('#voice-transcript'),
      'Speech helper is not running',
    );
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
    window.__openedMicrophoneSettings = 0;
    window.__openedSpeechSettings = 0;
    window.__voiceStartError = testOptions.voiceStartError || '';
    window.__lastAskPayload = null;
    window.__lastInjectPayload = null;
    window.__runtimeSummaryCalls = 0;
    window.__quickAskHandlers = {};
    const askStreamEvents = Array.isArray(testOptions.askStreamEvents)
      ? testOptions.askStreamEvents
      : [];
    const runtimeSequence = Array.isArray(testOptions.runtimeSequence)
      ? testOptions.runtimeSequence
      : null;
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
      openMicrophoneSettings: async () => {
        window.__openedMicrophoneSettings += 1;
      },
      openSpeechRecognitionSettings: async () => {
        window.__openedSpeechSettings += 1;
      },
    };
    window.quickAsk = {
      askStream: async (payload, onEvent) => {
        window.__lastAskPayload = payload;
        for (const event of askStreamEvents) {
          await onEvent(event);
        }
      },
      getActiveBrowserContext: async () =>
        testOptions.activeBrowserContext || { available: false },
      injectQuery: async (payload) => {
        window.__lastInjectPayload = payload;
        return testOptions.injectResult || { accepted: true };
      },
      remember: async () => ({ items: [] }),
      getRuntimeSummary: async () => {
        if (!runtimeSequence?.length) return runtime;
        const index = Math.min(
          window.__runtimeSummaryCalls,
          runtimeSequence.length - 1,
        );
        window.__runtimeSummaryCalls += 1;
        return runtimeSequence[index];
      },
      setLayout: async () => ({ ok: true }),
      hide: async () => undefined,
      openSettings: async () => {
        window.__openedSettings += 1;
      },
      openFullBridge: async () => undefined,
      newSession: async () => undefined,
      getPreferences: async () => ({ voiceLocale: 'zh-CN' }),
      startNativeVoice: async () => {
        if (window.__voiceStartError) {
          throw new Error(window.__voiceStartError);
        }
      },
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

async function currentSessionRowRoles(page) {
  return page.evaluate(() => {
    const blocks = Array.from(document.querySelectorAll('.session-block'));
    const current = blocks.at(-1);
    if (!current) return [];
    return Array.from(current.querySelectorAll(':scope > .message-row')).map(
      (row) =>
        Array.from(row.classList).find((className) =>
          className.startsWith('role-'),
        ) || '',
    );
  });
}

await main();
