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
      currentComments: 'Existing note',
      suggestedComments: 'Jira moved to resolved and release notes are ready',
      reason: ['Jira status changed to resolved'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'MTR-123407',
            status: 'Resolved',
            priority: 'High',
            summary: 'Finish Slides status integration',
            assignee: 'Ada',
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
      sourceInfo: {},
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
      reason: ['Only whitespace and case differ from the slide'],
      sourceInfo: {
        jiraIssues: [
          {
            key: 'NOOP-1',
            status: 'In progress',
            priority: 'Low',
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
  ],
  summary: {
    totalProjects: 4,
    projectsNeedingUpdate: 4,
    normalProjects: 0,
    attentionProjects: 1,
    riskProjects: 1,
    keyFindings: ['MTR-123407 status can move to on track'],
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

try {
  const fixtureHtml = `<!doctype html>
<html>
  <head><title>Slides Analyzer Fixture</title></head>
  <body>
    <button id="open-analysis">Open analysis</button>
    <script>
      window.appliedUpdates = null;
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
          const updatedCount = event.data.selectedUpdates.reduce((count, update) => {
            return count + [
              update.suggestedStatus,
              update.suggestedOwner,
              update.suggestedTrack,
              update.suggestedComments,
            ].filter(Boolean).length;
          }, 0);
          event.source.postMessage({
            type: 'UPDATE_SUCCESS',
            updatedCount,
            updates: event.data.selectedUpdates,
            errors: []
          }, event.origin);
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
      contentType: 'text/html',
      body: fixtureHtml,
    });
  });

  const opener = await context.newPage();
  await opener.goto('https://docs.google.com/presentation/d/test/edit#slide=id.slide-1');

  const popupPromise = context.waitForEvent('page');
  await opener.locator('#open-analysis').click();
  const analysisPage = await popupPromise;
  await analysisPage.waitForLoadState('load');

  await analysisPage.waitForSelector('.review-strip', { timeout: 15000 });
  const pageText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(pageText, /可更新字段 3/);
  assert.match(pageText, /高可信默认 2/);
  assert.match(pageText, /需复核项目 2/);
  assert.match(pageText, /缺少来源 1/);
  assert.match(pageText, /无法写回字段 1/);
  assert.match(pageText, /来源证据/);
  assert.match(pageText, /Jira: MTR-123407/);
  assert.match(pageText, /缺少可见来源或理由/);
  assert.match(pageText, /低可信建议未自动选中/);
  assert.match(pageText, /无法写回 状态列/);
  assert.match(pageText, /应用 2 个字段到 Slides/);
  assert.match(pageText, /当前视图 4 \/ 4 个建议/);

  assert.equal(await analysisPage.locator('#update-status-0').isChecked(), true);
  assert.equal(await analysisPage.locator('#update-comments-0').isChecked(), true);
  assert.equal(await analysisPage.locator('#update-owner-1').isChecked(), false);
  assert.equal(await analysisPage.locator('#select-all-2').isDisabled(), true);
  assert.equal(await analysisPage.locator('#select-all-3').isDisabled(), true);
  assert.equal(await analysisPage.locator('#update-status-3').count(), 0);
  assert.equal(await analysisPage.locator('#update-owner-3').count(), 0);
  assert.equal(await analysisPage.locator('#update-track-3').count(), 0);

  await analysisPage.locator('#review-filter-review').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 2);
  const reviewText = await analysisPage.locator('.slides-analysis').innerText();
  assert.match(reviewText, /Leadership summary/);
  assert.match(reviewText, /Missing status column/);

  await analysisPage.locator('#review-filter-selected').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /Quarterly status deck/);

  await analysisPage.locator('#review-filter-blocked').click();
  assert.equal(await analysisPage.locator('.project-item').count(), 1);
  assert.match(await analysisPage.locator('.slides-analysis').innerText(), /Missing status column/);

  await analysisPage.locator('#clear-selected-fields').click();
  assert.equal(await analysisPage.locator('#apply-updates-button').isDisabled(), true);
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 0 个字段到 Slides/);

  await analysisPage.locator('#restore-high-confidence-fields').click();
  assert.match(await analysisPage.locator('#apply-updates-button').innerText(), /应用 2 个字段到 Slides/);

  await analysisPage.locator('#review-filter-all').click();
  await analysisPage.locator('#update-owner-1').check();
  await analysisPage.waitForFunction(() => {
    const button = document.querySelector('#apply-updates-button');
    return button && button.textContent?.includes('应用 3 个字段到 Slides');
  });

  await analysisPage.locator('#apply-updates-button').click();
  await opener.waitForFunction(() => Array.isArray(window.appliedUpdates) && window.appliedUpdates.length === 2);

  const appliedUpdates = await opener.evaluate(() => window.appliedUpdates);
  assert.equal(appliedUpdates[0].suggestedStatus, 'On track');
  assert.equal(appliedUpdates[0].suggestedComments, 'Jira moved to resolved and release notes are ready');
  assert.equal(appliedUpdates[1].suggestedOwner, 'Cara');
  assert.equal(appliedUpdates[1].suggestedStatus, undefined);

  await analysisPage.waitForSelector('.success-message', { timeout: 15000 });
  const successText = await analysisPage.locator('.success-message').innerText();
  assert.match(successText, /已写回 3 个字段/);
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
