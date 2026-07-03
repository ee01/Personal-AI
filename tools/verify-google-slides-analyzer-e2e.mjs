import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = process.cwd();
const distPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-slides-analyzer-'));

const analysisResult = {
  projects: [],
  updateSuggestions: [
    {
      projectId: 'MTR-123407',
      projectName: 'Quarterly status deck',
      currentStatus: 'At risk',
      suggestedStatus: 'On track',
      currentOwner: 'Ada',
      currentTrack: 'Core',
      suggestedTrack: 'Growth',
      suggestedTrackReason: 'Planning source confirms Growth track',
      currentComments: 'Existing note\nJira moved to resolved',
      suggestedComments: 'Jira moved to resolved\nRelease notes are ready',
      reason: ['Jira status changed to resolved'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'MTR-123407',
            status: 'Resolved',
            priority: 'High',
            summary: 'Finish Slides status integration',
            assignee: 'Ada',
            updated: '2026-05-26T10:30:00.000+0000',
            url: 'https://jira.ringcentral.com/browse/MTR-123407',
          },
        ],
      },
      confidence: 0.92,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 1,
      columnIndices: {
        status: 1,
        owner: 2,
        comments: 3,
        track: 4,
      },
    },
    {
      projectId: 'AIT2-11063',
      projectName: 'Leadership summary',
      currentStatus: 'In progress',
      currentOwner: 'Ben',
      suggestedOwner: 'Cara',
      currentTrack: 'Growth',
      currentComments: '',
      reason: ['Owner inferred from recent Jira activity'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'AIT2-11063',
            status: 'Incomplete',
            priority: 'Medium',
            duedate: '2020-01-01',
            summary: 'Leadership summary owner follow-up',
            assignee: 'Cara',
            updated: '2026-05-24T18:20:00.000+0000',
            url: 'https://jira.ringcentral.com/browse/AIT2-11063',
          },
        ],
      },
      confidence: 0.55,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 2,
      columnIndices: {
        status: 1,
        owner: 2,
        comments: 3,
      },
    },
    {
      projectId: 'NO-COLUMN-1',
      projectName: 'Missing status column',
      currentStatus: 'At risk',
      suggestedStatus: 'On track',
      currentOwner: 'Dana',
      currentTrack: 'Ops',
      currentComments: '',
      reason: [],
      sourceInfo: {},
      confidence: 0.88,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 3,
      columnIndices: {
        status: -1,
        owner: 2,
        comments: 3,
      },
    },
    {
      projectId: 'NOOP-1',
      projectName: 'Formatting only noise',
      currentStatus: 'In progress',
      suggestedStatus: '  in   progress ',
      currentOwner: 'Ada Lovelace',
      suggestedOwner: 'ada lovelace',
      currentTrack: 'Core Platform',
      suggestedTrack: 'Core   Platform',
      currentComments: '',
      reason: ['No risk: only whitespace and case differ from the slide'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'NOOP-1',
            status: 'Done',
            priority: 'High',
            duedate: '2020-01-01',
            summary: 'Formatting-only result should not be actionable',
            assignee: 'Ada Lovelace',
            url: 'https://jira.ringcentral.com/browse/NOOP-1',
          },
        ],
      },
      confidence: 0.94,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 4,
      columnIndices: {
        status: 1,
        owner: 2,
        track: 3,
        comments: 4,
      },
    },
    {
      projectId: 'DUP-COMMENTS-1',
      projectName: 'Duplicate comments only',
      currentStatus: 'In progress',
      currentOwner: 'Ada',
      currentTrack: 'Core Platform',
      currentComments: 'Design review done. Follow up with PM.',
      suggestedComments: 'Design review done\nFollow up with PM',
      reason: ['Existing notes already cover the generated action items'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'DUP-COMMENTS-1',
            status: 'In progress',
            priority: 'Low',
            summary: 'Duplicate comment result should not be actionable',
            assignee: 'Ada',
            updated: '2026-05-20T09:00:00.000+0000',
            url: 'https://jira.ringcentral.com/browse/DUP-COMMENTS-1',
          },
        ],
      },
      confidence: 0.93,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 5,
      columnIndices: {
        status: 1,
        owner: 2,
        track: 3,
        comments: 4,
      },
    },
    {
      projectId: 'RISK-ONLY-1',
      projectName: 'Risk insight without writeback',
      currentStatus: 'Blocked',
      currentOwner: 'Eve',
      currentTrack: 'Platform',
      currentComments: 'Waiting for API contract',
      reason: ['Blocked by API contract'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'RISK-ONLY-1',
            status: 'In Progress',
            priority: 'High',
            summary: 'API contract follow-up',
            assignee: 'Eve',
            updated: '2026-05-25T15:45:00.000+0000',
          },
        ],
      },
      confidence: 0.9,
      slideId: 'slide-1',
      tableId: 'table-1',
      rowIndex: 6,
      columnIndices: {
        status: 1,
        owner: 2,
        track: 3,
        comments: 4,
      },
    },
  ],
  summary: {
    totalProjects: 6,
    projectsNeedingUpdate: 3,
    normalProjects: 0,
    attentionProjects: 1,
    riskProjects: 1,
    keyFindings: ['MTR-123407 status can move to on track'],
    analysisWarnings: ['幻灯片包含 2 个可信项目表格，已合并分析'],
    analyzedSlideCount: 1,
    totalSlideCount: 4,
    requestedSlideId: 'slide-1',
  },
};

async function launchExtensionContext() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
  };
}

const { context, extensionId } = await launchExtensionContext();
await context.addInitScript(() => {
  Object.defineProperty(window, '__slidesAnalyzerCopiedTexts', {
    value: [],
    writable: true,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: async (text) => {
        window.__slidesAnalyzerCopiedTexts.push(String(text));
      },
    },
    configurable: true,
  });
});

try {
  const fixtureHtml = `<!doctype html>
<html>
  <head><title>Slides Analyzer Fixture</title></head>
  <body>
    <div class="goog-toolbar-horizontal" id="slides-toolbar"></div>
    <button id="open-analysis">Open analysis</button>
    <script>
      window.appliedUpdates = null;
      window.pendingUpdateResponse = null;
      window.pendingUpdateErrors = [];
      window.pendingUpdatedCountOverride = null;
      window.sendPendingUpdateSuccess = () => {
        if (!window.pendingUpdateResponse) {
          return false;
        }

        const { source, origin, selectedUpdates } = window.pendingUpdateResponse;
        const errors = Array.isArray(window.pendingUpdateErrors) ? window.pendingUpdateErrors : [];
        const updatedCount = selectedUpdates.reduce((count, update) => {
          return count + [
            update.suggestedStatus,
            update.suggestedOwner,
            update.suggestedTrack,
            update.suggestedComments,
          ].filter(Boolean).length;
        }, 0);
        const confirmedUpdatedCount = Number.isFinite(window.pendingUpdatedCountOverride)
          ? window.pendingUpdatedCountOverride
          : updatedCount;

        source.postMessage({
          type: 'UPDATE_SUCCESS',
          updatedCount: confirmedUpdatedCount,
          updates: selectedUpdates,
          errors
        }, origin);
        window.pendingUpdateResponse = null;
        window.pendingUpdateErrors = [];
        window.pendingUpdatedCountOverride = null;
        return true;
      };
      window.sendPendingUpdateError = (message) => {
        if (!window.pendingUpdateResponse) {
          return false;
        }

        const { source, origin } = window.pendingUpdateResponse;
        const errorMessage = message || 'Google Slides API错误: atomic batch rejected';
        source.postMessage({
          type: 'UPDATE_ERROR',
          errorMessage,
          errors: [errorMessage],
        }, origin);
        window.pendingUpdateResponse = null;
        window.pendingUpdateErrors = [];
        return true;
      };
      window.addEventListener('message', event => {
        if (event.data && event.data.type === 'REQUEST_ANALYSIS_DATA') {
          event.source.postMessage({
            type: 'ANALYSIS_DATA',
            data: {
              presentationId: 'presentation-1',
              result: ${JSON.stringify(analysisResult)}
            }
          }, event.origin);
        }

        if (event.data && event.data.type === 'APPLY_PROJECT_UPDATES') {
          window.appliedUpdates = event.data.selectedUpdates;
          window.pendingUpdateResponse = {
            source: event.source,
            origin: event.origin,
            selectedUpdates: event.data.selectedUpdates,
          };
        }
      });

      document.getElementById('open-analysis').addEventListener('click', () => {
        window.open('chrome-extension://${extensionId}/slides-analysis.html', '_blank', 'width=1000,height=800');
      });
    </script>
  </body>
</html>`;

  await context.route('https://docs.google.com/presentation/d/test/edit**', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: fixtureHtml,
    });
  });

  const opener = await context.newPage();
  await opener.goto('https://docs.google.com/presentation/d/test/edit#slide=id.slide-1');
  await opener.waitForSelector('#analyze-projects-button', { timeout: 15000 });
  const toolbarButton = opener.locator('#analyze-projects-button');
  assert.match(
    await toolbarButton.innerText(),
    /分析项目/,
  );
  assert.equal(await toolbarButton.getAttribute('role'), 'button');
  assert.equal(await toolbarButton.getAttribute('tabindex'), '0');
  assert.match(
    await toolbarButton.getAttribute('aria-label'),
    /分析当前 Google Slides 项目信息/,
  );
  assert.match(
    await toolbarButton.getAttribute('title'),
    /分析当前 Google Slides 项目信息/,
  );
  const toolbarBusySnapshot = await opener.evaluate(() => {
    const button = document.querySelector('#analyze-projects-button');
    button.click();
    return {
      text: button.textContent || '',
      ariaDisabled: button.getAttribute('aria-disabled'),
      ariaBusy: button.getAttribute('aria-busy'),
      title: button.getAttribute('title') || '',
      cursor: button.style.cursor,
    };
  });
  assert.match(toolbarBusySnapshot.text, /获取授权|正在分析/);
  assert.equal(toolbarBusySnapshot.ariaDisabled, 'true');
  assert.equal(toolbarBusySnapshot.ariaBusy, 'true');
  assert.match(toolbarBusySnapshot.title, /正在/);
  assert.equal(toolbarBusySnapshot.cursor, 'wait');

  const duplicateToolbarClickSnapshot = await opener.evaluate(() => {
    const button = document.querySelector('#analyze-projects-button');
    button.click();
    const toast = document.querySelector('#slides-analyzer-toast');
    return {
      text: button.textContent || '',
      ariaDisabled: button.getAttribute('aria-disabled'),
      toastText: toast?.textContent || '',
    };
  });
  assert.match(duplicateToolbarClickSnapshot.text, /获取授权|正在分析/);
  assert.equal(duplicateToolbarClickSnapshot.ariaDisabled, 'true');
  assert.match(duplicateToolbarClickSnapshot.toastText, /Slides 分析正在进行/);

  await opener.evaluate(() => {
    document.querySelector('.goog-toolbar-horizontal')?.remove();
    const replacementToolbar = document.createElement('div');
    replacementToolbar.className = 'goog-toolbar-horizontal';
    replacementToolbar.id = 'slides-toolbar-rebuilt';
    document.body.prepend(replacementToolbar);
  });
  await opener.waitForFunction(() => {
    const buttons = document.querySelectorAll('#analyze-projects-button');
    const rebuiltToolbar = document.querySelector('#slides-toolbar-rebuilt');
    return buttons.length === 1 && rebuiltToolbar?.contains(buttons[0]);
  });

  const popupPromise = context.waitForEvent('page');
  await opener.locator('#open-analysis').click();
  const analysisPage = await popupPromise;
  await analysisPage.waitForLoadState('load');

  await analysisPage.waitForSelector('.review-strip', { timeout: 15000 });
  const pageText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(pageText, /可更新字段 4/);
  assert.match(pageText, /高可信默认 2/);
  assert.match(pageText, /需复核项目 2/);
  assert.match(pageText, /需复核字段 2/);
  assert.match(pageText, /风险项目 4/);
  assert.match(pageText, /缺少来源 1/);
  assert.match(pageText, /无法写回字段 1/);
  assert.match(pageText, /分析快照回执/);
  const snapshotReceiptText = await analysisPage.locator('.analysis-snapshot-receipt').innerText();
  assert.match(snapshotReceiptText, /presentation presentation-1/);
  assert.match(snapshotReceiptText, /目标 slide-1/);
  assert.match(snapshotReceiptText, /快照内容: 6 个项目，6 张建议卡，4 个可写字段，高可信默认 2 个；当前本页已选 2 个字段/);
  assert.match(snapshotReceiptText, /不会实时监听 deck 后续改动/);
  assert.match(snapshotReceiptText, /重新点击「分析项目」/);
  assert.match(snapshotReceiptText, /展示快照不会写回 Slides、不会重新分析 deck，也不会反写 Jira 或 Memory Service/);
  assert.match(pageText, /分析范围与提醒/);
  assert.match(pageText, /已分析 1 \/ 4 张 slide · 当前目标 slide-1/);
  assert.match(pageText, /范围判定回执/);
  assert.match(pageText, /只分析 1 \/ 4 张 slide，先按 当前目标 slide-1 的项目建议复核/);
  assert.match(pageText, /这不是整份 deck 完整扫描/);
  assert.match(pageText, /查看、筛选或复制本页内容不会重新分析 deck/);
  assert.match(pageText, /幻灯片包含 2 个可信项目表格，已合并分析/);
  assert.match(pageText, /字段复核队列/);
  assert.match(pageText, /需复核 2 个字段，无法写回 1 个字段/);
  assert.match(pageText, /MTR-123407 · Quarterly status deck · 备注/);
  assert.match(pageText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(pageText, /NO-COLUMN-1 · Missing status column · 状态/);
  assert.match(pageText, /风险焦点/);
  assert.match(pageText, /状态提示风险: At risk -> On track/);
  assert.match(pageText, /已逾期 Jira: AIT2-11063/);
  assert.match(pageText, /Risk insight without writeback/);
  assert.match(pageText, /此项目仅作为风险关注展示，目前没有可写回字段/);
  assert.equal(await analysisPage.locator('.field-review-queue-item').count(), 3);
  const queueText = await analysisPage.locator('.field-review-queue-list').innerText();
  assert.match(queueText, /MTR-123407 · Quarterly status deck · 备注/);
  assert.match(queueText, /追加备注: Release notes are ready/);
  assert.match(queueText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(queueText, /Ben -> Cara/);
  assert.match(queueText, /负责人建议置信度偏低，需人工确认后勾选。 Jira AIT2-11063: assignee Cara/);
  assert.match(queueText, /NO-COLUMN-1 · Missing status column · 状态/);
  assert.match(queueText, /At risk -> On track/);
  assert.match(queueText, /状态缺少直接来源，不会默认写回/);
  assert.equal(await analysisPage.locator('.project-risk-evidence-panel').count(), 4);
  assert.match(pageText, /来源证据/);
  assert.match(pageText, /Jira: MTR-123407/);
  assert.match(pageText, /Jira 最近更新: MTR-123407/);
  assert.match(pageText, /Release notes are ready/);
  assert.doesNotMatch(pageText, /Jira moved to resolved and release notes are ready/);
  assert.match(pageText, /部分字段缺少直接来源，未默认勾选: 备注/);
  assert.match(pageText, /低可信建议（负责人）未自动选中/);
  assert.match(pageText, /状态来源: Jira MTR-123407: Resolved/);
  assert.match(pageText, /赛道来源: Planning source confirms Growth track/);
  assert.match(pageText, /备注缺少直接来源，不会默认写回/);
  assert.match(pageText, /最近更新:/);
  assert.match(pageText, /无法写回 状态列/);
  assert.match(pageText, /无法写回字段建议值/);
  assert.match(pageText, /备注建议已存在于当前备注/);
  assert.match(pageText, /应用 2 个字段到 Slides/);
  assert.match(pageText, /已选字段: 2 个来源充分，无需额外复核/);
  assert.match(pageText, /即将写回/);
  assert.match(pageText, /写回决策回执/);
  assert.match(pageText, /提交范围: 2 个字段 \/ 1 个项目；当前视图 2 个，隐藏 0 个/);
  assert.match(pageText, /快照基准: 本次写回依据 .* 收到的 presentation presentation-1 \/ 目标 slide-1 分析快照/);
  assert.match(pageText, /应用前不会重新读取 deck、复查当前 slide\/table\/行列或确认协作编辑/);
  assert.match(pageText, /快照年龄: 本页已持有这份分析快照/);
  assert.match(pageText, /若 deck 已切页、表格重排或同事协作编辑，请先回 Slides 重新分析/);
  assert.match(pageText, /复核状态: 2 个字段均有直接来源/);
  assert.match(pageText, /未选、无法写回、仅风险关注项不会写入/);
  assert.match(pageText, /一次原子批量写回: 2 个字段 \/ 1 个项目，约 4 个 Slides 子请求/);
  assert.match(pageText, /Google Slides batchUpdate 任一子请求无效时，整批不会写入/);
  assert.match(pageText, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(pageText, /At risk -> On track/);
  assert.match(pageText, /MTR-123407 · Quarterly status deck · 赛道/);
  assert.match(pageText, /Core -> Growth/);
  assert.match(pageText, /当前视图 6 \/ 6 个建议/);
  assert.equal(await analysisPage.locator('a.jira-issue-key-link', { hasText: 'MTR-123407' }).count(), 1);
  assert.equal(await analysisPage.locator('a.jira-issue-key-link', { hasText: 'RISK-ONLY-1' }).count(), 0);
  assert.equal(await analysisPage.locator('.jira-issue-key-text', { hasText: 'RISK-ONLY-1' }).count(), 1);

  assert.equal(await analysisPage.locator('#update-status-0').isChecked(), true);
  assert.equal(await analysisPage.locator('#update-status-0').getAttribute('aria-label'), 'MTR-123407 状态 写回选择');
  assert.equal(await analysisPage.locator('#update-track-0').isChecked(), true);
  assert.equal(await analysisPage.locator('#update-track-0').getAttribute('aria-label'), 'MTR-123407 赛道 写回选择');
  assert.equal(await analysisPage.locator('#update-comments-0').isChecked(), false);
  assert.equal(await analysisPage.locator('#update-comments-0').getAttribute('aria-label'), 'MTR-123407 备注 写回选择');
  assert.equal(await analysisPage.locator('#review-queue-toggle-0-comments').isChecked(), false);
  assert.equal(await analysisPage.locator('#review-queue-toggle-1-owner').isChecked(), false);
  assert.equal(await analysisPage.locator('#update-owner-1').isChecked(), false);
  assert.equal(await analysisPage.locator('#update-owner-1').getAttribute('aria-label'), 'AIT2-11063 负责人 写回选择');
  assert.equal(await analysisPage.locator('#select-all-2').isDisabled(), true);
  assert.equal(await analysisPage.locator('#select-all-3').isDisabled(), true);
  assert.equal(await analysisPage.locator('#update-status-3').count(), 0);
  assert.equal(await analysisPage.locator('#update-owner-3').count(), 0);
  assert.equal(await analysisPage.locator('#update-track-3').count(), 0);
  assert.equal(await analysisPage.locator('#select-all-4').isDisabled(), true);
  assert.equal(await analysisPage.locator('#update-comments-4').count(), 0);
  assert.equal(await analysisPage.locator('#select-all-5').isDisabled(), true);

  await analysisPage.locator('#review-filter-review').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 2);
  const reviewText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(reviewText, /Quarterly status deck/);
  assert.match(reviewText, /Leadership summary/);
  assert.match(reviewText, /当前视图已选 2 个字段，全部已选 2 个字段/);

  await analysisPage.locator('#review-filter-risk').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 4);
  const riskText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(riskText, /Quarterly status deck/);
  assert.match(riskText, /Leadership summary/);
  assert.match(riskText, /Missing status column/);
  assert.match(riskText, /Risk insight without writeback/);
  assert.doesNotMatch(riskText, /Formatting only noise/);
  assert.equal(await analysisPage.locator('.project-risk-evidence-panel').count(), 4);

  await analysisPage.locator('#review-filter-selected').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /Quarterly status deck/);

  await analysisPage.locator('#review-filter-blocked').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  const blockedText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(blockedText, /Missing status column/);
  assert.match(blockedText, /无法写回字段建议值/);
  assert.match(blockedText, /状态/);
  assert.match(blockedText, /At risk -> On track/);
  assert.match(blockedText, /状态缺少直接来源，不会默认写回/);
  assert.match(blockedText, /当前筛选隐藏了 2 个已选字段/);

  await analysisPage.locator('#clear-selected-fields').click();
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), true);
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 0 个字段到 Slides/);
  const clearSelectionReceiptText = await analysisPage.locator('.selection-scope-receipt').innerText();
  assert.match(clearSelectionReceiptText, /选择范围回执/);
  assert.match(clearSelectionReceiptText, /已清空 2 个已选字段/);
  assert.match(clearSelectionReceiptText, /当前没有字段会提交/);
  assert.match(clearSelectionReceiptText, /没有重新分析 deck/);
  assert.match(clearSelectionReceiptText, /没有写回 Slides、Jira 或 Memory Service/);

  await analysisPage.locator('#review-filter-selected').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 0);
  const selectedEmptyText = await analysisPage.locator('.empty-filter-state').innerText();
  assert.match(selectedEmptyText, /当前没有已选字段/);
  assert.match(selectedEmptyText, /可以恢复高可信默认字段/);
  assert.match(selectedEmptyText, /查看全部建议/);
  assert.match(selectedEmptyText, /不会重新分析 deck/);
  assert.match(selectedEmptyText, /不会.*写回 Slides、Jira 或 Memory Service/);
  assert.equal(await analysisPage.locator('#empty-filter-restore-defaults').count(), 1);
  assert.equal(await analysisPage.locator('#empty-filter-show-all').count(), 1);

  await analysisPage.locator('#empty-filter-restore-defaults').click();
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 2 个字段到 Slides/);
  const restoredSelectionReceiptText = await analysisPage.locator('.selection-scope-receipt').innerText();
  assert.match(restoredSelectionReceiptText, /选择范围回执/);
  assert.match(restoredSelectionReceiptText, /已恢复 2 个高可信默认字段/);
  assert.match(restoredSelectionReceiptText, /只更新结果页本地提交范围/);
  assert.match(restoredSelectionReceiptText, /没有重新分析 deck/);
  assert.match(restoredSelectionReceiptText, /没有写回 Slides、Jira 或 Memory Service/);
  await analysisPage.locator('#review-filter-blocked').click();
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /当前筛选隐藏了 2 个已选字段/);
  await analysisPage.locator('#keep-visible-selected-fields').click();
  const narrowedSelectionReceiptText = await analysisPage.locator('.selection-scope-receipt').innerText();
  assert.match(narrowedSelectionReceiptText, /选择范围回执/);
  assert.match(narrowedSelectionReceiptText, /已移除 2 个当前筛选外的隐藏选择/);
  assert.match(narrowedSelectionReceiptText, /保留 0 个当前视图字段/);
  assert.match(narrowedSelectionReceiptText, /只收敛本地提交范围/);
  assert.match(narrowedSelectionReceiptText, /没有重新分析 deck/);
  assert.match(narrowedSelectionReceiptText, /没有写回 Slides、Jira 或 Memory Service/);
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), true);
  await analysisPage.locator('#restore-high-confidence-fields').click();
  await analysisPage.locator('#review-filter-blocked').click();
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /当前筛选隐藏了 2 个已选字段/);
  await analysisPage.locator('#show-selected-fields').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /Quarterly status deck/);

  await analysisPage.locator('#review-filter-all').click();
  await analysisPage.locator('#review-queue-toggle-1-owner').check();
  await analysisPage.waitForFunction(() => !document.querySelector('.selection-scope-receipt'));
  assert.equal(await analysisPage.locator('.selection-scope-receipt').count(), 0);
  await analysisPage.waitForFunction(() => {
    const button = document.querySelector('#apply-updates-button');
    return button && button.textContent?.includes('应用 3 个字段到 Slides');
  });
  assert.match(
    await analysisPage.locator('.selected-risk-summary').innerText(),
    /已选字段: 2 个来源充分，1 个需人工复核/,
  );
  const selectedPreviewText = await analysisPage.locator('.selected-writeback-preview').innerText();
  assert.match(selectedPreviewText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(selectedPreviewText, /Ben -> Cara/);
  assert.match(selectedPreviewText, /写入目标: slide-1 \/ table-1 \/ 表格第 2 行 \/ 状态第 2 列/);
  assert.match(selectedPreviewText, /写入目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(selectedPreviewText, /状态来源: Jira MTR-123407: Resolved · 更新/);
  assert.match(selectedPreviewText, /赛道来源: Planning source confirms Growth track/);
  assert.match(selectedPreviewText, /负责人建议置信度偏低，需人工确认后勾选。 Jira AIT2-11063: assignee Cara · 更新/);
  assert.match(selectedPreviewText, /需人工复核/);
  assert.match(selectedPreviewText, /提交范围: 3 个字段 \/ 2 个项目；当前视图 3 个，隐藏 0 个/);
  assert.match(selectedPreviewText, /快照基准: 本次写回依据 .* 收到的 presentation presentation-1 \/ 目标 slide-1 分析快照/);
  assert.match(selectedPreviewText, /快照年龄: 本页已持有这份分析快照/);
  assert.match(selectedPreviewText, /若 deck 已切页、表格重排或同事协作编辑，请先回 Slides 重新分析/);
  assert.match(selectedPreviewText, /复核状态: 2 个来源充分，1 个由你手动纳入/);
  assert.match(selectedPreviewText, /也不会反写 Jira 或 Memory Service/);
  assert.match(selectedPreviewText, /一次原子批量写回: 3 个字段 \/ 2 个项目，约 6 个 Slides 子请求/);
  assert.match(selectedPreviewText, /本地预检跳过项不会进入这批请求/);
  assert.equal(await analysisPage.locator('#copy-selected-writeback-review').count(), 1);
  await analysisPage.locator('#copy-selected-writeback-review').click();
  await analysisPage.waitForFunction(() => window.__slidesAnalyzerCopiedTexts.length > 0);
  const copiedReviewPacket = await analysisPage.evaluate(() => {
    const copiedTexts = window.__slidesAnalyzerCopiedTexts;
    return copiedTexts[copiedTexts.length - 1];
  });
  assert.match(copiedReviewPacket, /Google Slides 写回复核清单/);
  assert.match(copiedReviewPacket, /Presentation: presentation-1/);
  assert.match(copiedReviewPacket, /Selected fields: 3/);
  assert.match(copiedReviewPacket, /Batch: 一次原子批量写回: 3 个字段 \/ 2 个项目，约 6 个 Slides 子请求/);
  assert.match(copiedReviewPacket, /Batch boundary: Google Slides batchUpdate 任一子请求无效时，整批不会写入/);
  assert.match(copiedReviewPacket, /Decision receipt:/);
  assert.match(copiedReviewPacket, /提交范围: 3 个字段 \/ 2 个项目；当前视图 3 个，隐藏 0 个/);
  assert.match(copiedReviewPacket, /快照基准: 本次写回依据 .* 收到的 presentation presentation-1 \/ 目标 slide-1 分析快照/);
  assert.match(copiedReviewPacket, /应用前不会重新读取 deck、复查当前 slide\/table\/行列或确认协作编辑/);
  assert.match(copiedReviewPacket, /快照年龄: 本页已持有这份分析快照/);
  assert.match(copiedReviewPacket, /若 deck 已切页、表格重排或同事协作编辑，请先回 Slides 重新分析/);
  assert.match(copiedReviewPacket, /复核状态: 2 个来源充分，1 个由你手动纳入/);
  assert.match(copiedReviewPacket, /未选、无法写回、仅风险关注项不会写入/);
  assert.match(copiedReviewPacket, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(copiedReviewPacket, /At risk -> On track/);
  assert.match(copiedReviewPacket, /目标: slide-1 \/ table-1 \/ 表格第 2 行 \/ 状态第 2 列/);
  assert.match(copiedReviewPacket, /MTR-123407 · Quarterly status deck · 赛道/);
  assert.match(copiedReviewPacket, /Core -> Growth/);
  assert.match(copiedReviewPacket, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(copiedReviewPacket, /Ben -> Cara/);
  assert.match(copiedReviewPacket, /目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(copiedReviewPacket, /Jira AIT2-11063: assignee Cara · 更新/);
  assert.match(copiedReviewPacket, /复核: 需人工复核/);
  const copyReceiptText = await analysisPage.locator('.selected-writeback-copy-receipt').innerText();
  assert.match(copyReceiptText, /复核清单复制回执/);
  assert.match(copyReceiptText, /已复制 3 个字段 \/ 2 个项目；presentation presentation-1/);
  assert.match(copyReceiptText, /复制快照: 当时当前视图 3 个，隐藏 0 个，人工纳入 1 个/);
  assert.match(copyReceiptText, /当前选择仍匹配这份复制清单/);
  assert.match(copyReceiptText, /复制只写入本机剪贴板/);
  assert.match(copyReceiptText, /不会写回 Slides/);
  assert.match(copyReceiptText, /不会反写 Jira 或 Memory Service/);

  await analysisPage.locator('#update-track-0').uncheck();
  await analysisPage.waitForFunction(() => (
    document.querySelector('.selected-writeback-copy-receipt')?.textContent?.includes('当前选择已变更')
  ));
  const staleCopyReceiptText = await analysisPage.locator('.selected-writeback-copy-receipt').innerText();
  assert.match(staleCopyReceiptText, /当前选择已变更/);
  assert.match(staleCopyReceiptText, /现在已选 2 个字段/);
  assert.match(staleCopyReceiptText, /剪贴板里的旧清单不会自动更新/);
  await analysisPage.locator('#update-track-0').check();
  await analysisPage.waitForFunction(() => (
    document.querySelector('.selected-writeback-copy-receipt')?.textContent?.includes('当前选择仍匹配这份复制清单')
  ));

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => Array.isArray(window.appliedUpdates) && window.appliedUpdates.length === 2);
  await analysisPage.waitForSelector('.apply-submission-receipt', { timeout: 5000 });
  const submissionReceiptText = await analysisPage.locator('.apply-submission-receipt').innerText();
  assert.match(submissionReceiptText, /提交中回执/);
  assert.match(submissionReceiptText, /已向原 Google Slides 页面发送 3 个字段 \/ 2 个项目的写回请求/);
  assert.match(submissionReceiptText, /presentation presentation-1/);
  assert.match(submissionReceiptText, /快照基准: 本次写回依据 .* 收到的 presentation presentation-1 \/ 目标 slide-1 分析快照/);
  assert.match(submissionReceiptText, /快照年龄: 本页已持有这份分析快照/);
  assert.match(submissionReceiptText, /若 deck 已切页、表格重排或同事协作编辑，请先回 Slides 重新分析/);
  assert.match(submissionReceiptText, /字段勾选、筛选视图、全选和复核队列已暂时锁定/);
  assert.match(submissionReceiptText, /等待 Google Slides API 返回/);
  assert.match(submissionReceiptText, /不会追加新字段/);
  assert.match(submissionReceiptText, /不会重新分析 deck/);
  assert.match(submissionReceiptText, /不会反写 Jira 或 Memory Service/);
  assert.equal(await analysisPage.locator('#update-status-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#update-track-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#select-all-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#review-queue-toggle-1-owner').isDisabled(), true);
  assert.equal(await analysisPage.locator('#review-filter-all').isDisabled(), true);
  assert.equal(await analysisPage.locator('#review-filter-selected').isDisabled(), true);
  assert.equal(await analysisPage.locator('#queue-filter-review').isDisabled(), true);
  assert.equal(await analysisPage.locator('#review-filter-risk-inline').isDisabled(), true);

  const appliedUpdates = await opener.evaluate(() => window.appliedUpdates);
  assert.equal(appliedUpdates[0].suggestedStatus, 'On track');
  assert.equal(appliedUpdates[0].suggestedTrack, 'Growth');
  assert.equal(appliedUpdates[0].suggestedComments, undefined);
  assert.equal(appliedUpdates[1].suggestedOwner, 'Cara');
  assert.equal(appliedUpdates[1].suggestedStatus, undefined);

  assert.equal(await opener.evaluate(() => window.sendPendingUpdateError(
    'Google Slides API错误: batchUpdate rejected because one subrequest was invalid',
  )), true);
  await analysisPage.waitForSelector('.apply-failure-message', { timeout: 15000 });
  assert.equal(await analysisPage.locator('.apply-submission-receipt').count(), 0);
  const failureText = await analysisPage.locator('.apply-failure-message').innerText();
  assert.match(failureText, /写回未完成/);
  assert.match(failureText, /Google Slides API错误: batchUpdate rejected because one subrequest was invalid/);
  assert.match(failureText, /一次原子批量写回: 3 个字段 \/ 2 个项目，约 6 个 Slides 子请求/);
  assert.match(failureText, /整批不会写入/);
  assert.match(failureText, /本次未完成字段/);
  assert.match(failureText, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(failureText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(failureText, /写入目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(failureText, /失败原因/);
  assert.match(failureText, /失败接管清单/);
  assert.match(failureText, /整批没有确认写入/);
  assert.match(failureText, /不要把这批字段当成已写入/);
  assert.equal(await analysisPage.locator('.apply-failure-handoff-item').count(), 3);
  assert.equal(await analysisPage.locator('#copy-apply-failure-handoff').count(), 1);
  const copiedCountAfterReview = await analysisPage.evaluate(() => window.__slidesAnalyzerCopiedTexts.length);
  await analysisPage.locator('#copy-apply-failure-handoff').click();
  await analysisPage.waitForFunction((previousCount) => (
    window.__slidesAnalyzerCopiedTexts.length > previousCount
  ), copiedCountAfterReview);
  const copiedFailurePacket = await analysisPage.evaluate(() => {
    const copiedTexts = window.__slidesAnalyzerCopiedTexts;
    return copiedTexts[copiedTexts.length - 1];
  });
  assert.match(copiedFailurePacket, /Google Slides 写回失败接管清单/);
  assert.match(copiedFailurePacket, /Boundary: Google Slides 没有确认这批字段写入/);
  assert.match(copiedFailurePacket, /Google Slides API错误: batchUpdate rejected because one subrequest was invalid/);
  assert.match(copiedFailurePacket, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(copiedFailurePacket, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(copiedFailurePacket, /目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(copiedFailurePacket, /下一步: 先按本次字段目标核对 slide、表格、行列和权限/);
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), false);

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => (
    window.pendingUpdateResponse &&
    Array.isArray(window.appliedUpdates) &&
    window.appliedUpdates.length === 2
  ));
  const ambiguousSkippedReason = 'Skipped one submitted field because the target table was protected during precheck';
  assert.equal(await opener.evaluate((skippedReason) => {
    window.pendingUpdateErrors = [
      skippedReason,
    ];
    window.pendingUpdatedCountOverride = 2;
    return window.sendPendingUpdateSuccess();
  }, ambiguousSkippedReason), true);
  await analysisPage.waitForSelector('.success-message', { timeout: 15000 });
  const ambiguousSuccessText = await analysisPage.locator('.success-message').innerText();
  assert.match(ambiguousSuccessText, /Google Slides 已确认写回 2 个字段，跳过 1 项/);
  assert.match(ambiguousSuccessText, /1 个跳过或缺失原因未能匹配到具体字段/);
  assert.match(ambiguousSuccessText, /字段级已确认列表已隐藏，避免把未写入字段误标为已落地/);
  assert.match(ambiguousSuccessText, /未匹配到提交字段 · 跳过项/);
  assert.match(ambiguousSuccessText, /人工核对/);
  assert.equal(await analysisPage.locator('.apply-skipped-handoff-match-badge-manual', { hasText: '人工核对' }).count(), 1);
  assert.match(ambiguousSuccessText, /没有匹配到字段级回执/);
  assert.equal(await analysisPage.locator('.success-message .applied-field-receipt-item').count(), 0);
  const copiedCountAfterAmbiguousSkipped = await analysisPage.evaluate(() => window.__slidesAnalyzerCopiedTexts.length);
  await analysisPage.locator('#copy-apply-skipped-handoff').click();
  await analysisPage.waitForFunction((previousCount) => (
    window.__slidesAnalyzerCopiedTexts.length > previousCount
  ), copiedCountAfterAmbiguousSkipped);
  const copiedAmbiguousSkippedPacket = await analysisPage.evaluate(() => {
    const copiedTexts = window.__slidesAnalyzerCopiedTexts;
    return copiedTexts[copiedTexts.length - 1];
  });
  assert.match(copiedAmbiguousSkippedPacket, /Confirmed batch: Google Slides 已确认写回 2 个字段，但 1 个跳过或缺失原因未能匹配到具体字段；已隐藏字段级确认列表/);
  assert.match(copiedAmbiguousSkippedPacket, /未匹配到提交字段 · 跳过项/);
  assert.match(copiedAmbiguousSkippedPacket, /跳过原因: Skipped one submitted field because the target table was protected during precheck/);

  await analysisPage.locator('#restore-high-confidence-fields').click();
  await analysisPage.locator('#review-filter-all').click();
  await analysisPage.locator('#review-queue-toggle-1-owner').check();
  await analysisPage.waitForFunction(() => {
    const button = document.querySelector('#apply-updates-button');
    return button && button.textContent?.includes('应用 3 个字段到 Slides');
  });

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => (
    window.pendingUpdateResponse &&
    Array.isArray(window.appliedUpdates) &&
    window.appliedUpdates.length === 2
  ));
  assert.equal(await opener.evaluate(() => {
    window.pendingUpdateErrors = [];
    window.pendingUpdatedCountOverride = 2;
    return window.sendPendingUpdateSuccess();
  }), true);
  await analysisPage.waitForSelector('.success-message', { timeout: 15000 });
  const missingReasonSuccessText = await analysisPage.locator('.success-message').innerText();
  assert.match(missingReasonSuccessText, /Google Slides 已确认写回 2 个字段，跳过 1 项/);
  assert.match(missingReasonSuccessText, /1 个跳过或缺失原因未能匹配到具体字段/);
  assert.match(missingReasonSuccessText, /还有 1 个字段没有返回具体跳过原因/);
  assert.match(missingReasonSuccessText, /不要把未解释字段当成已落地/);
  assert.match(missingReasonSuccessText, /未匹配到提交字段 · 跳过项/);
  assert.equal(await analysisPage.locator('.success-message .applied-field-receipt-item').count(), 0);
  const copiedCountAfterMissingReason = await analysisPage.evaluate(() => window.__slidesAnalyzerCopiedTexts.length);
  await analysisPage.locator('#copy-apply-skipped-handoff').click();
  await analysisPage.waitForFunction((previousCount) => (
    window.__slidesAnalyzerCopiedTexts.length > previousCount
  ), copiedCountAfterMissingReason);
  const copiedMissingReasonPacket = await analysisPage.evaluate(() => {
    const copiedTexts = window.__slidesAnalyzerCopiedTexts;
    return copiedTexts[copiedTexts.length - 1];
  });
  assert.match(copiedMissingReasonPacket, /Skipped or unconfirmed: 1 项没有字段级写入确认/);
  assert.match(copiedMissingReasonPacket, /没有返回具体跳过原因/);
  assert.match(copiedMissingReasonPacket, /未解释字段不要当成已写入/);

  await analysisPage.locator('#restore-high-confidence-fields').click();
  await analysisPage.locator('#review-filter-all').click();
  await analysisPage.locator('#review-queue-toggle-1-owner').check();
  await analysisPage.waitForFunction(() => {
    const button = document.querySelector('#apply-updates-button');
    return button && button.textContent?.includes('应用 3 个字段到 Slides');
  });

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => (
    window.pendingUpdateResponse &&
    Array.isArray(window.appliedUpdates) &&
    window.appliedUpdates.length === 2
  ));
  const targetOnlySkippedReason = 'Skipped AIT2-11063 Leadership summary at slide-1 / table-1 / row 3 / column 3: invalid cell location';
  assert.equal(await opener.evaluate((skippedReason) => {
    window.pendingUpdateErrors = [
      skippedReason,
    ];
    window.pendingUpdatedCountOverride = 2;
    return window.sendPendingUpdateSuccess();
  }, targetOnlySkippedReason), true);
  await analysisPage.waitForSelector('.success-message', { timeout: 15000 });
  const successText = await analysisPage.locator('.success-message').innerText();
  assert.match(successText, /Google Slides 已确认写回 2 个字段，跳过 1 项/);
  assert.match(successText, /一次原子批量写回: 2 个字段 \/ 1 个项目，约 4 个 Slides 子请求/);
  assert.match(successText, /Google Slides 已确认实际发送的批次整体完成/);
  assert.match(successText, /原始选择为 3 个字段，其中 1 个已转入下方人工接管清单/);
  assert.match(successText, /Google Slides 已确认写回字段/);
  assert.match(successText, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(successText, /MTR-123407 · Quarterly status deck · 赛道/);
  assert.match(successText, /跳过原因/);
  assert.match(successText, /Skipped AIT2-11063 Leadership summary at slide-1 \/ table-1 \/ row 3 \/ column 3: invalid cell location/);
  assert.match(successText, /人工接管清单/);
  assert.match(successText, /对照建议值和跳过原因，处理完再重新分析或手动更新 Slides/);
  assert.match(successText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(successText, /可重选/);
  assert.match(successText, /Ben -> Cara/);
  assert.match(successText, /写入目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(successText, /下一步: 回到原 slide 确认项目行仍存在，再重新触发分析。/);
  assert.equal(await analysisPage.locator('.applied-field-receipt-item').count(), 2);
  assert.equal(await analysisPage.locator('.apply-skipped-handoff-item').count(), 1);
  assert.equal(await analysisPage.locator('.apply-skipped-handoff-match-badge-reselectable', { hasText: '可重选' }).count(), 1);
  assert.equal(await analysisPage.locator('#copy-apply-skipped-handoff').count(), 1);
  const copiedCountAfterFailure = await analysisPage.evaluate(() => window.__slidesAnalyzerCopiedTexts.length);
  await analysisPage.locator('#copy-apply-skipped-handoff').click();
  await analysisPage.waitForFunction((previousCount) => (
    window.__slidesAnalyzerCopiedTexts.length > previousCount
  ), copiedCountAfterFailure);
  const copiedSkippedPacket = await analysisPage.evaluate(() => {
    const copiedTexts = window.__slidesAnalyzerCopiedTexts;
    return copiedTexts[copiedTexts.length - 1];
  });
  assert.match(copiedSkippedPacket, /Google Slides 跳过字段接管清单/);
  assert.match(copiedSkippedPacket, /Presentation: presentation-1/);
  assert.match(copiedSkippedPacket, /Confirmed writeback: Google Slides 已确认写回 2 个字段/);
  assert.match(copiedSkippedPacket, /Skipped or unconfirmed: 1 项没有字段级写入确认/);
  assert.match(copiedSkippedPacket, /Confirmed batch: 一次原子批量写回: 2 个字段 \/ 1 个项目，约 4 个 Slides 子请求/);
  assert.match(copiedSkippedPacket, /Selected before precheck: 一次原子批量写回: 3 个字段 \/ 2 个项目，约 6 个 Slides 子请求/);
  assert.match(copiedSkippedPacket, /Boundary: Google Slides 已确认已发送批次整体完成；下列跳过或未解释项没有字段级写入确认/);
  assert.match(copiedSkippedPacket, /Non-effects: 未选、无法写回、仅风险关注项不会写入，也不会反写 Jira 或 Memory Service/);
  assert.match(copiedSkippedPacket, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(copiedSkippedPacket, /Ben -> Cara/);
  assert.match(copiedSkippedPacket, /目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);
  assert.match(copiedSkippedPacket, /跳过原因: Skipped AIT2-11063 Leadership summary at slide-1 \/ table-1 \/ row 3 \/ column 3: invalid cell location/);
  assert.match(copiedSkippedPacket, /下一步: 回到原 slide 确认项目行仍存在，再重新触发分析。/);
  const skippedReselectBoundaryText = await analysisPage.locator('.apply-skipped-reselect-boundary').innerText();
  assert.match(skippedReselectBoundaryText, /已匹配 1 个可重选字段/);
  assert.match(skippedReselectBoundaryText, /重选只改变本页选择，不会自动重试或写回/);
  assert.equal(await analysisPage.locator('#reselect-apply-skipped-fields').isDisabled(), false);
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), true);
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 0 个字段到 Slides/);
  await analysisPage.locator('#reselect-apply-skipped-fields').click();
  await analysisPage.waitForFunction(() => {
    const button = document.querySelector('#apply-updates-button');
    return button && button.textContent?.includes('应用 1 个字段到 Slides');
  });
  const reselectReceiptText = await analysisPage.locator('.selection-scope-receipt').innerText();
  assert.match(reselectReceiptText, /选择范围回执/);
  assert.match(reselectReceiptText, /已重新选择 1 个已匹配跳过字段/);
  assert.match(reselectReceiptText, /不会立即重试/);
  assert.match(reselectReceiptText, /不会写回 Slides/);
  assert.match(reselectReceiptText, /不会反写 Jira 或 Memory Service/);
  const reselectedPreviewText = await analysisPage.locator('.selected-writeback-preview').innerText();
  assert.match(reselectedPreviewText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(reselectedPreviewText, /Ben -> Cara/);
  assert.match(reselectedPreviewText, /写入目标: slide-1 \/ table-1 \/ 表格第 3 行 \/ 负责人第 3 列/);

  const orphanPage = await context.newPage();
  await orphanPage.goto(`chrome-extension://${extensionId}/slides-analysis.html`);
  await orphanPage.waitForSelector('.load-error-panel', { timeout: 15000 });
  const orphanText = await orphanPage.locator('.load-error-panel').innerText();
  assert.match(orphanText, /无法与父窗口通信/);
  assert.equal(await orphanPage.locator('.btn-secondary').isDisabled(), true);
  await orphanPage.close();

  const slowOpenerHtml = `<!doctype html>
<html>
  <head><title>Slides Analyzer Slow Fixture</title></head>
  <body>
    <button id="open-analysis">Open slow analysis</button>
    <script>
      window.receivedAnalysisRequests = 0;
      window.addEventListener('message', event => {
        if (event.data && event.data.type === 'REQUEST_ANALYSIS_DATA') {
          window.receivedAnalysisRequests += 1;
        }
      });

      document.getElementById('open-analysis').addEventListener('click', () => {
        window.open('chrome-extension://${extensionId}/slides-analysis.html', '_blank', 'width=1000,height=800');
      });
    </script>
  </body>
</html>`;

  await context.route('https://docs.google.com/presentation/d/slow/edit**', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: slowOpenerHtml,
    });
  });

  const slowOpener = await context.newPage();
  await slowOpener.goto('https://docs.google.com/presentation/d/slow/edit');
  const slowPopupPromise = context.waitForEvent('page');
  await slowOpener.locator('#open-analysis').click();
  const slowAnalysisPage = await slowPopupPromise;
  await slowAnalysisPage.waitForLoadState('load');
  await slowAnalysisPage.waitForSelector('.load-error-panel', { timeout: 15000 });
  const initialSlowErrorText = await slowAnalysisPage.locator('.load-error-panel').innerText();
  assert.match(initialSlowErrorText, /未收到 Slides 页面返回的分析数据/);
  assert.doesNotMatch(initialSlowErrorText, /重新请求回执/);
  await slowAnalysisPage.locator('.load-error-panel .btn-secondary').click();
  await slowAnalysisPage.waitForSelector('.load-recovery-receipt', { timeout: 5000 });
  const recoveryReceiptText = await slowAnalysisPage.locator('.load-recovery-receipt').innerText();
  assert.match(recoveryReceiptText, /重新请求回执/);
  assert.match(recoveryReceiptText, /只向原 Google Slides 页面请求当前分析结果快照/);
  assert.match(recoveryReceiptText, /不会重新分析 deck/);
  assert.match(recoveryReceiptText, /不会写回 Slides/);
  assert.match(recoveryReceiptText, /不会反写 Jira 或 Memory Service/);
  assert.equal(await slowOpener.evaluate(() => window.receivedAnalysisRequests), 2);
  await slowAnalysisPage.close();
  await slowOpener.close();

  console.log('google_slides_analyzer extension E2E passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
