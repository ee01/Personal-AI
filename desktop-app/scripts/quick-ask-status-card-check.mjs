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

    await page.locator('#scope-personal-button').click();
    await page.waitForFunction(
      () => window.__lastSettingsPatch?.explorer?.askDefaultScope === 'personal',
    );
    await assertTextIncludes(page.locator('#shortcut-banner'), '范围已保存');
    await assertTextIncludes(
      page.locator('#shortcut-banner'),
      '后续 Quick Ask / Ask 默认用个人范围',
    );
    await assertTextIncludes(
      page.locator('#shortcut-banner'),
      '不会改已入库记忆',
    );
    await assertTextIncludes(
      page.locator('#shortcut-banner'),
      '不会触发同步发送',
    );

    const localOnlyScopePage = await setupQuickAskPage(
      browser,
      url,
      runtimeSummary,
      {
        settingsWithoutExplorer: true,
      },
    );
    await localOnlyScopePage.locator('#scope-both-button').click();
    await assertTextIncludes(
      localOnlyScopePage.locator('#shortcut-banner'),
      '范围已切到两者',
    );
    await assertTextIncludes(
      localOnlyScopePage.locator('#shortcut-banner'),
      '默认值未保存',
    );
    await assertTextIncludes(
      localOnlyScopePage.locator('#shortcut-banner'),
      '只影响当前 Quick Ask 窗口后续提问',
    );
    assert.equal(
      await localOnlyScopePage.evaluate(() => window.__lastSettingsPatch),
      null,
    );

    const failedScopePage = await setupQuickAskPage(browser, url, runtimeSummary, {
      settingsUpdateErrorMessage: 'disk is read-only',
    });
    await failedScopePage.locator('#scope-personal-button').click();
    await failedScopePage.waitForFunction(
      () => window.__lastSettingsPatch?.explorer?.askDefaultScope === 'personal',
    );
    await assertTextIncludes(
      failedScopePage.locator('#shortcut-banner'),
      '默认值保存失败：disk is read-only',
    );
    await assertTextIncludes(
      failedScopePage.locator('#shortcut-banner'),
      '只影响当前 Quick Ask 窗口后续提问',
    );

    const mixedRuntimeSummary = {
      ...runtimeSummary,
      pendingConfirmCount: 1,
      queuedActionCount: 3,
      pendingApprovalCount: 0,
      topStatus: {
        kind: 'sync_issue',
        label: '豆包同步异常',
        count: 1,
        priority: 3,
      },
      items: [
        {
          kind: 'sync_issue',
          title: '豆包同步异常',
          summary: '最近一次 mobile_context_thread 投递失败。',
          detailLines: ['失败链路：mobile_context_thread'],
          count: 1,
          badgeLabel: '需恢复',
          actionHint: '继续排查同步',
          priority: 3,
        },
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
        {
          kind: 'queued_action',
          title: '动作排队中',
          summary: 'OpenClaw 委派动作等待执行。',
          detailLines: ['队列中：3'],
          count: 3,
          badgeLabel: '排队 3',
          actionHint: '继续追问动作',
          priority: 7,
        },
      ],
      fetchedAt: '2026-05-21T00:01:00.000Z',
    };
    const clearedRuntimeSummary = {
      ...mixedRuntimeSummary,
      pendingConfirmCount: 0,
      queuedActionCount: 0,
      topStatus: undefined,
      items: [],
      fetchedAt: '2026-05-21T00:02:00.000Z',
    };
    const mixedStatusPage = await setupQuickAskPage(
      browser,
      url,
      mixedRuntimeSummary,
      {
        now: Date.parse('2026-05-21T00:02:00.000Z'),
        runtimeSequence: [mixedRuntimeSummary, clearedRuntimeSummary],
      },
    );
    await mixedStatusPage.locator('#status-pill').click();
    await assertTextIncludes(
      mixedStatusPage.locator('.status-card-composition').first(),
      '状态构成（3 类）：1 个同步异常、1 个待确认、3 个排队动作',
    );
    await assertTextIncludes(
      mixedStatusPage.locator('.status-card-composition').first(),
      '不会批准、重试、发送、取消、归档或写入',
    );
    await assertTextIncludes(
      mixedStatusPage.locator('.status-item-count-basis').first(),
      '本行：1 个同步异常 · 来源：本机同步流水',
    );
    await mixedStatusPage.locator('.status-card-refresh').first().click();
    await assertText(
      mixedStatusPage.locator('.status-empty').first(),
      '刚刚重新读取过，目前没有需要关注的运行态。',
    );
    assert.equal(
      await mixedStatusPage.locator('.status-card-composition').count(),
      0,
    );

    const statusPill = page.locator('#status-pill');
    await statusPill.waitFor({ state: 'visible' });
    await assertText(statusPill, '外部询问待批准发送');
    await assertAttributeIncludes(statusPill, 'title', '点击只展开 Quick Ask 状态卡');
    await assertAttributeIncludes(statusPill, 'title', '不打开设置');
    await assertAttributeIncludes(statusPill, 'aria-label', '不会批准、重试、发送、取消、归档或写入');

    await statusPill.click();
    const statusItem = page.locator('.status-item').first();
    await statusItem.waitFor({ state: 'visible' });
    await assertText(page.locator('.status-card-meta').first(), '快照：2 分钟前 · 1 项状态');
    await assertTextIncludes(
      page.locator('.status-card-composition').first(),
      '状态构成：2 个外部询问',
    );
    await assertText(page.locator('.status-item-source').first(), 'Outreach 运行态');
    await assertText(page.locator('.status-item-freshness').first(), '2 分钟前读取');
    await assertText(
      page.locator('.status-item-count-basis').first(),
      '本行：2 个外部询问 · 来源：Outreach 运行态 · 当前快照只读，不会执行、批准、重试、发送、取消、归档或写入。',
    );
    await assertText(page.locator('.status-item-title').first(), '外部询问待批准发送');
    await assertText(page.locator('.status-item-summary').first(), '是否向 Chris 追问发布窗口？');
    await assertText(
      page.locator('.status-item-priority').first(),
      '外部询问：先区分待你批准发送，还是等待对方回复。',
    );
    await assertText(page.locator('.status-item-details').first(), '待你确认发送：2');
    await assertText(page.locator('.status-item-hint').first(), '查看待发内容');
    await assertText(
      page.locator('.status-item-action-label').first(),
      '查看待发内容',
    );
    await assertTextIncludes(
      page.locator('.status-item-action-boundary').first(),
      '不会发送 outreach',
    );
    const refreshButton = page.locator('.status-card-refresh').first();
    await assertAttributeIncludes(refreshButton, 'title', '重新读取当前运行态快照');
    await assertAttributeIncludes(refreshButton, 'aria-label', '只刷新状态卡和状态胶囊');
    await assertAttributeIncludes(refreshButton, 'aria-label', '不会批准、重试、发送、取消、归档、写入或改配置');

    await refreshButton.click();
    await assertText(page.locator('.status-refresh-note').first(), '已重新读取状态快照。');
    await assertText(page.locator('.status-card-meta').first(), '快照：刚刚刷新 · 1 项状态');
    await assertText(page.locator('.status-item-source').first(), 'Memory Service 确认请求');
    await assertText(page.locator('.status-item-freshness').first(), '刚刚读取');
    await assertText(page.locator('.status-item-title').first(), '待你确认');
    await assertText(page.locator('.status-item-summary').first(), '是否记录新的回复偏好？');

    const slowRefreshPage = await setupQuickAskPage(browser, url, runtimeSummary, {
      now: Date.parse('2026-05-21T00:02:00.000Z'),
      runtimeSequence: [runtimeSummary, refreshedRuntimeSummary],
      runtimeSummaryDelayMs: 250,
    });
    await slowRefreshPage.locator('#status-pill').click();
    const slowRefreshButton = slowRefreshPage.locator('.status-card-refresh').first();
    await slowRefreshButton.click();
    await slowRefreshPage.waitForFunction(() => {
      const button = document.querySelector('.status-card-refresh');
      return Boolean(button?.disabled);
    });
    await assertAttributeIncludes(
      slowRefreshButton,
      'title',
      '正在重新读取运行态快照',
    );
    await assertAttributeIncludes(
      slowRefreshButton,
      'aria-label',
      '刷新中会阻止重复点击',
    );
    await assertText(slowRefreshPage.locator('.status-refresh-note').first(), '正在重新读取运行态...');
    await slowRefreshPage.waitForFunction(
      () => document.querySelector('.status-card-refresh')?.textContent?.includes('重新读取'),
    );

    await statusPill.click();
    await assertText(page.locator('.status-item-title').first(), '待你确认');
    assert.equal(await page.locator('.role-status').count(), 1);
    await assertText(
      page.locator('.status-item-action-label').first(),
      '继续追问这条状态',
    );
    await assertTextIncludes(
      page.locator('.status-item-action-boundary').first(),
      '不会批准',
    );

    await statusItem.click();
    const draft = await page.locator('#composer').inputValue();
    assert.match(draft, /关于「待你确认」/);
    assert.match(draft, /是否记录新的回复偏好/);
    assert.match(draft, /来自用户画像确认请求/);
    assert.match(draft, /继续追问这条状态/);
    assert.match(
      draft,
      /数量口径：本行：1 个待确认 · 来源：Memory Service 确认请求/,
    );
    assert.match(draft, /这条状态来自刚刚读取的快照/);
    assert.match(draft, /显示原因：需要你确认：不会自动写入或发送。/);
    assert.match(draft, /处理入口：只把待确认项带入追问草稿/);
    assert.match(draft, /不会批准、拒绝或写入/);
    assert.match(draft, /帮我总结这些待确认项/);
    assert.equal(await page.evaluate(() => window.__openedSettings), 0);

    const failedRefreshPage = await setupQuickAskPage(browser, url, runtimeSummary, {
      now: Date.parse('2026-05-21T00:02:00.000Z'),
      runtimeSequence: [runtimeSummary],
      runtimeSummaryErrorAtCalls: [1],
      runtimeSummaryErrorMessage: 'connect ECONNREFUSED 127.0.0.1:3210',
    });
    await failedRefreshPage.locator('#status-pill').click();
    await failedRefreshPage.locator('.status-card-refresh').first().click();
    await assertTextIncludes(
      failedRefreshPage.locator('.status-refresh-note').first(),
      '重新读取失败，当前状态未确认',
    );
    await assertTextIncludes(
      failedRefreshPage.locator('.status-refresh-note').first(),
      '上次成功快照',
    );
    await assertText(
      failedRefreshPage.locator('.status-item-freshness').first(),
      '刷新失败 · 上次快照',
    );
    await failedRefreshPage.locator('.status-item').first().click();
    const failedRefreshDraft = await failedRefreshPage
      .locator('#composer')
      .inputValue();
    assert.match(failedRefreshDraft, /刚刚失败：重新读取失败/);
    assert.match(failedRefreshDraft, /当前状态未确认/);
    assert.match(failedRefreshDraft, /上次成功快照/);
    assert.match(failedRefreshDraft, /ECONNREFUSED/);

    const staleRuntimePage = await setupQuickAskPage(browser, url, runtimeSummary, {
      now: Date.parse('2026-05-21T00:31:00.000Z'),
    });
    await staleRuntimePage.locator('#status-pill').click();
    await assertText(
      staleRuntimePage.locator('.status-card-meta').first(),
      '快照：31 分钟前 · 1 项状态',
    );
    await assertText(
      staleRuntimePage.locator('.status-item-freshness').first(),
      '旧快照 · 先重新读取',
    );
    await staleRuntimePage.locator('.status-item').first().click();
    const staleDraft = await staleRuntimePage.locator('#composer').inputValue();
    assert.match(
      staleDraft,
      /数量口径：本行：2 个外部询问 · 来源：Outreach 运行态/,
    );
    assert.match(staleDraft, /31 分钟前的旧快照/);
    assert.match(staleDraft, /先点重新读取确认它是否仍然存在/);

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
    await assertText(
      runtimeIssuePage.locator('.status-item-action-label').first(),
      '测试 Memory Service',
    );
    await assertTextIncludes(
      runtimeIssuePage.locator('.status-item-action-boundary').first(),
      '不会重试服务',
    );
    await assertText(
      runtimeIssuePage.locator('.status-item-priority').first(),
      '先确认状态：读取失败时不能把旧状态当最新。',
    );

    await runtimeStatusItem.click();
    const runtimeDraft = await runtimeIssuePage.locator('#composer').inputValue();
    assert.match(runtimeDraft, /关于「状态读取异常」/);
    assert.match(runtimeDraft, /ECONNREFUSED/);
    assert.match(runtimeDraft, /不是同步已完成/);
    assert.match(runtimeDraft, /测试 Memory Service/);
    assert.match(runtimeDraft, /处理入口：只把状态读取异常带入排查草稿/);
    assert.match(runtimeDraft, /不会重试服务或改配置/);
    assert.equal(await runtimeIssuePage.evaluate(() => window.__openedSettings), 0);

    const setupBlockerPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: {
        kind: 'setup_blocker',
        label: 'Desktop App 未完成设置',
        count: 1,
        priority: 1,
      },
      items: [
        {
          kind: 'setup_blocker',
          title: 'Desktop App 未完成设置',
          summary: '缺少 Memory Service User ID。',
          detailLines: ['写操作需要 X-User-Id。'],
          count: 1,
          badgeLabel: '需设置',
          actionHint: '打开设置补齐',
          priority: 1,
        },
      ],
    });
    await setupBlockerPage.locator('#status-pill').click();
    await assertText(
      setupBlockerPage.locator('.status-item-action-label').first(),
      '打开设置补齐',
    );
    await assertTextIncludes(
      setupBlockerPage.locator('.status-item-action-boundary').first(),
      '不会自动同步',
    );
    await setupBlockerPage.locator('.status-item').first().click();
    await setupBlockerPage.waitForFunction(() => window.__openedSettings === 1);

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

    const delayedContextPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      deferActiveBrowserContext: true,
      activeBrowserContext: {
        available: true,
        title: 'RingCentral',
        url: 'https://app.ringcentral.com/messages/153798238214',
        visibleText: 'MTR-141852: AI Custom VBG 那个 BE ready 了吗？',
      },
      askStreamEvents: [
        {
          type: 'result',
          answer: '延迟上下文答案',
          evidence: [],
          runtime: { items: [] },
        },
      ],
    });
    await delayedContextPage.locator('#composer').fill('那个 BE ready 了吗？');
    await delayedContextPage.keyboard.press('Enter');
    await delayedContextPage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
          'pending' &&
        document.body.textContent?.includes('正在检索相关记忆') &&
        window.__activeBrowserContextPending === true &&
        !window.__lastAskPayload,
    );
    await assertText(
      delayedContextPage.locator('.pending-status-copy').first(),
      '正在检索相关记忆...',
    );
    await assertText(
      delayedContextPage.locator('#pending-hint'),
      '正在检索相关记忆...',
    );
    await delayedContextPage.evaluate(() => {
      window.__resolveActiveBrowserContext?.();
    });
    await delayedContextPage.waitForFunction(
      () => window.__lastAskPayload?.query === '那个 BE ready 了吗？',
    );
    await delayedContextPage.waitForFunction(() =>
      document.body.textContent?.includes('延迟上下文答案'),
    );

    const ambiguousAskPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      askStreamEvents: [
        {
          type: 'result',
          answer: [
            '这个问题可能指向多个近期话题：AI Generated VBG、AI Notes。',
            '',
            '候选话题：',
            '1. AI Generated VBG (匹配角色词、近期高频)',
            '2. AI Notes (匹配角色词、近期高频)',
            '',
            '你可以直接回复候选序号，或补上项目 / 群组 / issue key；确认后我再继续查证状态和证据。',
          ].join('\n'),
          contextMatch: {
            state: 'ambiguous',
            candidates: [
              {
                label: 'AI Generated VBG',
                reasons: ['匹配角色词', '近期高频'],
              },
              {
                label: 'AI Notes',
                reasons: ['匹配角色词', '近期高频'],
              },
            ],
          },
          runtime: { items: [] },
        },
      ],
    });
    await ambiguousAskPage.locator('#composer').fill('那个 BE ready 了吗？');
    await ambiguousAskPage.keyboard.press('Enter');
    await ambiguousAskPage.waitForFunction(
      () => window.__lastAskPayload?.query === '那个 BE ready 了吗？',
    );
    await ambiguousAskPage
      .locator('.ask-candidate-choice')
      .nth(1)
      .waitFor({ state: 'visible' });
    await assertText(
      ambiguousAskPage.locator('.ask-candidate-choice').nth(1).locator('strong'),
      'AI Notes',
    );
    await ambiguousAskPage.locator('.ask-candidate-choice').nth(1).click();
    await ambiguousAskPage.waitForFunction(
      () => window.__lastAskPayload?.query === '2',
    );
    await assertText(
      ambiguousAskPage.locator('.role-user').last().locator('p'),
      '选择话题：AI Notes',
    );
    const candidateFollowupContext = await ambiguousAskPage.evaluate(
      () => window.__lastAskPayload?.context || '',
    );
    assert.match(candidateFollowupContext, /User: 那个 BE ready 了吗？/);
    assert.match(candidateFollowupContext, /Assistant: 这个问题可能指向多个近期话题/);
    assert.match(candidateFollowupContext, /候选话题：/);

    const sessionStart = Date.parse('2026-05-25T09:00:00.000Z');
    const sessionPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    }, {
      now: sessionStart,
      injectResult: {
        accepted: true,
        threadId: 'mobile-context-thread-abcdef123456',
        transportMode: 'playwright',
        transportFallbackReason: 'No existing doubao.com tab found in Chrome',
        verified: true,
        messageVisible: true,
        challengeDetected: false,
      },
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
    await assertAttributeIncludes(
      mobileSyncButton,
      'title',
      '发送 query_answer_card（本轮答案 + 1 条证据摘要）到 mobile_context_thread',
    );
    await assertAttributeIncludes(
      mobileSyncButton,
      'aria-label',
      '不写长期记忆、不确认答案、不改绑定、不标记待办完成',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      'query_answer_card（本轮答案 + 1 条证据摘要）-> mobile_context_thread',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '不写长期记忆、不确认答案、不改绑定、不标记待办完成',
    );

    await sessionPage.evaluate(() => {
      window.__holdInjectQuery = true;
    });
    await mobileSyncButton.click();
    await sessionPage.waitForFunction(
      () => window.__injectQueryWaiting === true,
    );
    await assertAttributeIncludes(
      mobileSyncButton,
      'title',
      '请求已提交，尚未确认 query_answer_card（本轮答案 + 1 条证据摘要）已写入 mobile_context_thread',
    );
    await assertAttributeIncludes(
      mobileSyncButton,
      'aria-label',
      '等待结果时不会重复发送',
    );
    await sessionPage.evaluate(() => window.__releaseInjectQuery?.());
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
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '已发送：query_answer_card（本轮答案 + 1 条证据摘要）-> mobile_context_thread',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '只写已绑定手机对话',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '本次审计：线程：mobile-c...123456',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '已验证 · 消息可见 · 传输：内置 Chromium',
    );
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').first(),
      '回退原因：No existing doubao.com tab found in Chrome',
    );
    await assertAttributeIncludes(
      mobileSyncButton,
      'title',
      '已完成一次发送，按钮保留本次结果且不会再次发送',
    );

    await sessionPage.evaluate(() => {
      window.__injectResultOverride = {
        accepted: false,
        error: 'mobile_context_not_bound',
      };
    });
    await sessionPage.locator('#composer').fill('第二件事是什么');
    await sessionPage.keyboard.press('Enter');
    await sessionPage.waitForFunction(
      () => window.__lastAskPayload?.query === '第二件事是什么',
    );
    const failedMobileSyncButton = sessionPage
      .locator('.quick-ask-sync-mobile')
      .last();
    await failedMobileSyncButton.click();
    await assertTextIncludes(
      sessionPage.locator('.message-action-status').last(),
      '手机对话未绑定，请先打开设置重新绑定。',
    );
    await assertAttributeIncludes(
      failedMobileSyncButton,
      'title',
      '上次失败没有确认写入 mobile_context_thread',
    );
    await assertAttributeIncludes(
      failedMobileSyncButton,
      'aria-label',
      '重试仍只发送本轮 query_answer_card',
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
    await assertTextIncludes(
      voicePage.locator('#voice-receipt'),
      '本机语音识别',
    );
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '不会自动发送');
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'title', '停止监听');
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'aria-label', '不会发送');
    await assertAttributeIncludes(voicePage.locator('#voice-send'), 'title', '不可发送');
    await voicePage.locator('#voice-orb').click();
    await voicePage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'stopped',
        text: '',
      });
    });
    await voicePage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-ready',
    );
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '已停止监听');
    await assertTextIncludes(
      voicePage.locator('#voice-receipt'),
      '未听到可发送内容',
    );
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '没有发送');
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '保存音频');
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '发起 Ask');
    assert.equal(await voicePage.locator('#voice-send').isDisabled(), true);
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'title', '继续说话');
    await assertAttributeIncludes(voicePage.locator('#voice-send'), 'aria-label', '没有可发送语音草稿');
    await assertAttributeIncludes(voicePage.locator('#voice-cancel'), 'title', '没有语音内容');
    await voicePage.locator('#voice-orb').click();
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
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '语音未发送');
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '草稿已保留');
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'title', '重试语音输入');
    await assertAttributeIncludes(voicePage.locator('#voice-recovery'), 'title', '打开语音识别设置');
    await assertAttributeIncludes(voicePage.locator('#voice-recovery'), 'aria-label', '不会发送语音草稿');
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
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '语音未发送');
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'aria-label', '重试语音输入');

    const voiceInterruptedPage = await setupQuickAskPage(browser, url, {
      ...runtimeSummary,
      topStatus: undefined,
      items: [],
    });
    await voiceInterruptedPage.locator('#voice-button').click();
    await voiceInterruptedPage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-listening',
    );
    await voiceInterruptedPage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'transcript',
        text: '请总结今天的重点',
        isFinal: false,
      });
      window.__quickAskHandlers.voice?.({
        type: 'error',
        code: 'speech_error_1101',
        message: 'Speech recognition interrupted',
      });
      window.__quickAskHandlers.voice?.({
        type: 'stopped',
        text: '请总结今天的重点',
        reason: 'error',
      });
    });
    await voiceInterruptedPage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-ready',
    );
    await assertText(
      voiceInterruptedPage.locator('#voice-transcript'),
      '请总结今天的重点',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '识别中断',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '未确认语音草稿',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '没有发送',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '保存音频',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '发起 Ask',
    );
    await assertTextIncludes(
      voiceInterruptedPage.locator('#voice-receipt'),
      '先核对人名/项目词',
    );
    assert.equal(
      await voiceInterruptedPage.locator('#voice-send').isDisabled(),
      false,
    );
    await assertAttributeIncludes(voiceInterruptedPage.locator('#voice-orb'), 'title', '重试语音输入');
    await assertAttributeIncludes(voiceInterruptedPage.locator('#voice-send'), 'title', '发送语音草稿');
    await assertAttributeIncludes(voiceInterruptedPage.locator('#voice-send'), 'aria-label', '工作范围');
    await assertAttributeIncludes(voiceInterruptedPage.locator('#voice-cancel'), 'title', '带回输入框');
    await voiceInterruptedPage.locator('#voice-cancel').click();
    assert.equal(
      await voiceInterruptedPage.locator('#composer').inputValue(),
      '请总结今天的重点',
    );

    await voicePage.evaluate(() => {
      window.__voiceStartError = '';
    });
    await voicePage.locator('#voice-orb').click();
    await voicePage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-listening',
    );
    await voicePage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'transcript',
        text: '请总结今天的重点',
        isFinal: false,
      });
    });
    await assertText(voicePage.locator('#voice-transcript'), '请总结今天的重点');
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '正在听写');
    await assertAttributeIncludes(voicePage.locator('#voice-orb'), 'title', '保留当前语音草稿');
    await voicePage.locator('#voice-orb').click();
    await voicePage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'stopped',
        text: '请总结今天的重点',
      });
    });
    await voicePage.waitForFunction(
      () =>
        document.querySelector('#quick-ask-shell')?.dataset.state ===
        'voice-ready',
    );
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '语音草稿');
    await assertTextIncludes(voicePage.locator('#voice-receipt'), '已停止监听');
    await assertTextIncludes(
      voicePage.locator('#voice-receipt'),
      '点箭头才会发送转写文本',
    );
    await assertAttributeIncludes(voicePage.locator('#voice-send'), 'title', '发送语音草稿');
    await assertAttributeIncludes(voicePage.locator('#voice-send'), 'aria-label', '不发送或保存原始音频');
    await voicePage.locator('#voice-cancel').click();
    assert.equal(await voicePage.locator('#composer').inputValue(), '请总结今天的重点');

    await voicePage.locator('#composer').fill('');
    await voicePage.locator('#voice-button').click();
    await voicePage.evaluate(() => {
      window.__quickAskHandlers.voice?.({
        type: 'transcript',
        text: '帮我查一下今天的重点',
        isFinal: true,
      });
    });
    await assertAttributeIncludes(voicePage.locator('#voice-send'), 'title', '发送语音草稿');
    await voicePage.locator('#voice-send').click();
    await voicePage.waitForFunction(
      () => window.__lastAskPayload?.query === '帮我查一下今天的重点',
    );
    const voiceAskPayload = await voicePage.evaluate(() => window.__lastAskPayload);
    assert.equal(voiceAskPayload.scope, 'work');
    await assertText(
      voicePage.locator('.role-user').last().locator('p'),
      '帮我查一下今天的重点',
    );
    const voiceSubmitReceipt = voicePage
      .locator('.role-user')
      .last()
      .locator('.user-message-receipt');
    await assertTextIncludes(voiceSubmitReceipt, '语音草稿已确认发送');
    await assertTextIncludes(voiceSubmitReceipt, '工作范围');
    await assertTextIncludes(voiceSubmitReceipt, '只提交转写文本');
    await assertTextIncludes(voiceSubmitReceipt, '不发送或保存原始音频');
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
    window.__lastSettingsPatch = null;
    window.__runtimeSummaryCalls = 0;
    window.__quickAskHandlers = {};
    window.__activeBrowserContextPending = false;
    window.__resolveActiveBrowserContext = null;
    const askStreamEvents = Array.isArray(testOptions.askStreamEvents)
      ? testOptions.askStreamEvents
      : [];
    const runtimeSequence = Array.isArray(testOptions.runtimeSequence)
      ? testOptions.runtimeSequence
      : null;
    window.bridgeApi = {
      getSettings: async () =>
        testOptions.settingsWithoutExplorer
          ? {
              effective: {},
            }
          : {
              effective: {
                explorer: {
                  askDefaultScope: 'work',
                },
                uiLanguage: 'zh-CN',
              },
            },
      updateSettings: async (payload) => {
        window.__lastSettingsPatch = payload;
        if (testOptions.settingsUpdateErrorMessage) {
          throw new Error(testOptions.settingsUpdateErrorMessage);
        }
        return {
          effective: {
            explorer: {
              askDefaultScope: payload?.explorer?.askDefaultScope || 'work',
            },
          },
        };
      },
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
      getActiveBrowserContext: async () => {
        if (testOptions.deferActiveBrowserContext) {
          window.__activeBrowserContextPending = true;
          await new Promise((resolve) => {
            window.__resolveActiveBrowserContext = () => {
              window.__activeBrowserContextPending = false;
              window.__resolveActiveBrowserContext = null;
              resolve();
            };
          });
        }
        return testOptions.activeBrowserContext || { available: false };
      },
      injectQuery: async (payload) => {
        window.__lastInjectPayload = payload;
        if (window.__holdInjectQuery) {
          window.__injectQueryWaiting = true;
          await new Promise((resolve) => {
            window.__releaseInjectQuery = () => {
              window.__holdInjectQuery = false;
              window.__injectQueryWaiting = false;
              window.__releaseInjectQuery = null;
              resolve();
            };
          });
        }
        return (
          window.__injectResultOverride ||
          testOptions.injectResult || { accepted: true }
        );
      },
      remember: async () => ({ items: [] }),
      getRuntimeSummary: async () => {
        const callIndex = window.__runtimeSummaryCalls;
        window.__runtimeSummaryCalls += 1;
        if (testOptions.runtimeSummaryDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, testOptions.runtimeSummaryDelayMs),
          );
        }
        if (
          Array.isArray(testOptions.runtimeSummaryErrorAtCalls) &&
          testOptions.runtimeSummaryErrorAtCalls.includes(callIndex)
        ) {
          throw new Error(
            testOptions.runtimeSummaryErrorMessage ||
              'Runtime summary unavailable',
          );
        }
        if (!runtimeSequence?.length) return runtime;
        const index = Math.min(
          callIndex,
          runtimeSequence.length - 1,
        );
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

async function assertTextIncludes(locator, expected) {
  const text = (await locator.textContent())?.replace(/\s+/g, ' ').trim() || '';
  assert.ok(
    text.includes(expected),
    `${JSON.stringify(text)} should include ${JSON.stringify(expected)}`,
  );
}

async function assertAttributeIncludes(locator, attribute, expected) {
  const value = (await locator.getAttribute(attribute)) || '';
  assert.ok(
    value.includes(expected),
    `${attribute} ${JSON.stringify(value)} should include ${JSON.stringify(expected)}`,
  );
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
