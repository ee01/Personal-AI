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

        source.postMessage({
          type: 'UPDATE_SUCCESS',
          updatedCount,
          updates: selectedUpdates,
          errors
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
  assert.match(pageText, /分析范围与提醒/);
  assert.match(pageText, /已分析 1 \/ 4 张 slide · 当前目标 slide-1/);
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

  await analysisPage.locator('#restore-high-confidence-fields').click();
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 2 个字段到 Slides/);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /当前筛选隐藏了 2 个已选字段/);
  await analysisPage.locator('#show-selected-fields').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /Quarterly status deck/);

  await analysisPage.locator('#review-filter-all').click();
  await analysisPage.locator('#review-queue-toggle-1-owner').check();
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
  assert.match(selectedPreviewText, /状态来源: Jira MTR-123407: Resolved · 更新/);
  assert.match(selectedPreviewText, /赛道来源: Planning source confirms Growth track/);
  assert.match(selectedPreviewText, /负责人建议置信度偏低，需人工确认后勾选。 Jira AIT2-11063: assignee Cara · 更新/);
  assert.match(selectedPreviewText, /需人工复核/);
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
  assert.match(copiedReviewPacket, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(copiedReviewPacket, /At risk -> On track/);
  assert.match(copiedReviewPacket, /MTR-123407 · Quarterly status deck · 赛道/);
  assert.match(copiedReviewPacket, /Core -> Growth/);
  assert.match(copiedReviewPacket, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(copiedReviewPacket, /Ben -> Cara/);
  assert.match(copiedReviewPacket, /Jira AIT2-11063: assignee Cara · 更新/);
  assert.match(copiedReviewPacket, /复核: 需人工复核/);

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => Array.isArray(window.appliedUpdates) && window.appliedUpdates.length === 2);
  assert.equal(await analysisPage.locator('#update-status-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#update-track-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#select-all-0').isDisabled(), true);
  assert.equal(await analysisPage.locator('#review-queue-toggle-1-owner').isDisabled(), true);

  const appliedUpdates = await opener.evaluate(() => window.appliedUpdates);
  assert.equal(appliedUpdates[0].suggestedStatus, 'On track');
  assert.equal(appliedUpdates[0].suggestedTrack, 'Growth');
  assert.equal(appliedUpdates[0].suggestedComments, undefined);
  assert.equal(appliedUpdates[1].suggestedOwner, 'Cara');
  assert.equal(appliedUpdates[1].suggestedStatus, undefined);

  assert.equal(await opener.evaluate(() => {
    window.pendingUpdateErrors = [
      '无法更新负责人: AIT2-11063 - Leadership summary 缺少可写表格列',
    ];
    return window.sendPendingUpdateSuccess();
  }), true);
  await analysisPage.waitForSelector('.success-message', { timeout: 15000 });
  const successText = await analysisPage.locator('.success-message').innerText();
  assert.match(successText, /已写回 3 个字段，跳过 1 项/);
  assert.match(successText, /本次提交字段/);
  assert.match(successText, /MTR-123407 · Quarterly status deck · 状态/);
  assert.match(successText, /MTR-123407 · Quarterly status deck · 赛道/);
  assert.match(successText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(successText, /负责人建议置信度偏低，需人工确认后勾选。 Jira AIT2-11063: assignee Cara · 更新/);
  assert.match(successText, /跳过原因/);
  assert.match(successText, /无法更新负责人: AIT2-11063 - Leadership summary 缺少可写表格列/);
  assert.match(successText, /人工接管清单/);
  assert.match(successText, /对照建议值和跳过原因，处理完再重新分析或手动更新 Slides/);
  assert.match(successText, /AIT2-11063 · Leadership summary · 负责人/);
  assert.match(successText, /Ben -> Cara/);
  assert.match(successText, /下一步: 在 Slides 表格补齐对应列，或按建议值手动填入后重新分析。/);
  assert.equal(await analysisPage.locator('.applied-field-receipt-item').count(), 3);
  assert.equal(await analysisPage.locator('.apply-skipped-handoff-item').count(), 1);
  assert.equal(await analysisPage.locator('#copy-apply-skipped-handoff').count(), 1);
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), true);
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 0 个字段到 Slides/);

  const orphanPage = await context.newPage();
  await orphanPage.goto(`chrome-extension://${extensionId}/slides-analysis.html`);
  await orphanPage.waitForSelector('.load-error-panel', { timeout: 15000 });
  const orphanText = await orphanPage.locator('.load-error-panel').innerText();
  assert.match(orphanText, /无法与父窗口通信/);
  assert.equal(await orphanPage.locator('.btn-secondary').isDisabled(), true);
  await orphanPage.close();

  console.log('google_slides_analyzer extension E2E passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
