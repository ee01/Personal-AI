import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = process.cwd();
const distPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-jira-design-links-'));

const fixtureHtml = `<!doctype html>
<html>
  <head>
    <title>ABC-123 - Jira Fixture</title>
  </head>
  <body>
    <main>
      <section class="issue-header-content">
        <h1>ABC-123 Test issue</h1>
      </section>
      <span id="type-val">Story</span>
      <div id="description-val">
        Please inspect
        <a href="https://www.figma.com/design/abc123/Spec?node-id=1-2" title="Checkout mobile handoff">the design</a>
        and the pasted URL https://www.figma.com/design/abc123/Spec?node-id=1-2).
        The encoded Jira duplicate is https://www.figma.com/design/abc123/Renamed?node-id=1%3A2&t=share.
        The workshop board is https://miro.com/app/board/uXjVdemo.
        The Zeplin handoff is https://app.zeplin.io/project/abc/screen/def.
        Ignore https://notfigma.com/design/abc.
        Ignore the plugin page https://www.figma.com/community/plugin/123-demo.
        Ignore Figma documentation https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma.
        Ignore Zeplin marketing https://zeplin.io/integrations/jira.
        Ignore Zeplin profile https://app.zeplin.io/profile.
        Ignore Zeplin settings https://app.zeplin.io/project/abc/settings.
        Ignore Miro marketing https://miro.com/pricing.
        Ignore Loom product news https://www.loom.com/blog/product-updates.
      </div>
      <section data-testid="issue-designs-panel" aria-label="Designs">
        <h2>Designs</h2>
        <article data-testid="linked-design-card">
          <strong>Native pricing handoff</strong>
          <span>Changed</span>
          <a href="https://www.figma.com/design/native456/Pricing?node-id=0-1">Open in Figma</a>
        </article>
      </section>
      <div class="links-list">
        <div class="links-section">
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/browse/UX-100">UX-100</a>
            <span class="issue-link-summary">Checkout UX handoff</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/browse/UX-200">UX-200</a>
            <span class="issue-link-summary">Missing design spec</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/browse/UXDES-300">UXDES-300</a>
            <span class="issue-link-summary">Shared UXDES spec</span>
          </div>
          <div class="issue-link">
            <span class="issue-link-key" data-issue-key="UXRAW-400">blocked by UXRAW-400</span>
            <span class="issue-link-summary">Raw text fallback UX spec</span>
          </div>
          <div class="issue-link">
            <span class="issue-link-key" aria-label="blocked by ABC-999 and design owner UXMULTI-500">ABC-999 references UXMULTI-500</span>
            <span class="issue-link-summary">Mixed raw key fallback UX spec</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/jira/software/c/projects/UX/issues/UXCLOUD-600">Open design dependency</a>
            <span class="issue-link-summary">Cloud URL fallback UX spec</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/jira/software/c/projects/UX/boards/77?selectedIssue=UXQUERY-700">Open selected dependency</a>
            <span class="issue-link-summary">Query selected issue fallback UX spec</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/browse/ABC-123?selectedIssue=UXQUERY-701">Open current issue with selected design dependency</a>
            <span class="issue-link-summary">Mixed path query fallback UX spec</span>
          </div>
          <div class="issue-link">
            <a class="issue-link-key" href="https://jira.ringcentral.com/jira/software/c/projects/UX/issues/?jql=issuekey%20%3D%20UXJQL-800">Open filtered design dependency</a>
            <span class="issue-link-summary">JQL filtered issue fallback UX spec</span>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>`;

const filteredOnlyFixtureHtml = `<!doctype html>
<html>
  <head>
    <title>GHI-789 - Jira Fixture</title>
  </head>
  <body>
    <main>
      <section class="issue-header-content">
        <h1>GHI-789 Filtered-only issue</h1>
      </section>
      <span id="type-val">Story</span>
      <div id="description-val">
        This issue mentions design tooling docs, but not a handoff artifact:
        https://www.figma.com/community/plugin/123-demo,
        https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma,
        and https://app.zeplin.io/project/abc/settings.
      </div>
      <div class="links-list"></div>
    </main>
  </body>
</html>`;

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`,
  ],
});

try {
  await context.route(/https:\/\/jira\.ringcentral\.com\/browse\/ABC-123\/?$/, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: fixtureHtml,
    });
  });
  await context.route(/https:\/\/jira\.ringcentral\.com\/browse\/GHI-789\/?$/, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: filteredOnlyFixtureHtml,
    });
  });
  await context.route(/https:\/\/jira\.ringcentral\.com\/browse\/UX[A-Z]*-\d+\/?$/, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>UX issue fixture</title><h1>UX issue fixture</h1>',
    });
  });
  await context.route(/https:\/\/www\.figma\.com\/.*/, route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Figma fixture</title><h1>Figma fixture</h1>',
    });
  });
  await context.route('https://jira.ringcentral.com/rest/api/2/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const fulfillJson = data => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

    if (pathname === '/rest/api/2/issue/ABC-123/remotelink') {
      return fulfillJson([
        {
          object: {
            title: 'Ready checkout prototype',
            url: 'https://www.figma.com/proto/remote123/Checkout',
            status: {
              icon: {
                title: 'ready_for_development',
              },
              updatedAt: '2026-05-19T12:34:00.000+0000',
            },
            updatedDate: '2026-05-18T10:20:00.000+0000',
          },
        },
        {
          object: {
            title: 'Draft onboarding walkthrough',
            url: 'https://www.loom.com/share/notready123',
            status: {
              icon: {
                title: 'not_ready_for_dev',
              },
            },
            updatedDate: '2026-05-17T09:15:00.000+0000',
          },
        },
        {
          globalId: 'appId=figma&url=https%3A%2F%2Fwww.figma.com%2Fdesign%2Fglobal789%2FSettings%3Fnode-id%3D5-6',
          object: {
            title: 'Settings fallback handoff',
            url: 'https://example.com/not-design',
            status: {
              icon: {
                title: 'Changed',
              },
            },
            updatedDate: '2026-05-20T11:00:00.000+0000',
          },
        },
        {
          object: {
            title: 'Day precision handoff',
            url: 'https://www.figma.com/design/dayonly999/Calendar',
            status: {
              icon: {
                title: 'Changed',
              },
            },
            updatedDate: '2026-05-21',
          },
        },
        {
          object: {
            title: 'Ignore implementation note',
            url: 'https://example.com/not-design',
          },
        },
      ]);
    }

    if (pathname === '/rest/api/2/issue/DEF-456/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/GHI-789/remotelink') {
      return fulfillJson([
        {
          object: {
            title: 'Zeplin profile reference',
            url: 'https://app.zeplin.io/profile',
          },
        },
      ]);
    }

    if (pathname === '/rest/api/2/issue/UX-100/remotelink') {
      return fulfillJson([
        {
          object: {
            title: 'Ready checkout prototype',
            url: 'https://www.figma.com/proto/remote123/Checkout',
            status: {
              icon: {
                title: 'ready_for_development',
              },
            },
            updatedDate: '2026-05-18T10:20:00.000+0000',
          },
        },
      ]);
    }

    if (pathname === '/rest/api/2/issue/UX-200/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXDES-300/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXRAW-400/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXMULTI-500/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXCLOUD-600/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXQUERY-700/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXQUERY-701/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UXJQL-800/remotelink') {
      return fulfillJson([]);
    }

    if (pathname === '/rest/api/2/issue/UX-100') {
      return fulfillJson({
        key: 'UX-100',
        fields: {
          summary: 'Checkout UX handoff',
          issuetype: { name: 'Epic' },
          status: { name: 'Cancelled' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UX-200') {
      return fulfillJson({
        key: 'UX-200',
        fields: {
          summary: 'Missing design spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: 'https://www.figma.com/community/plugin/ux200-nonhandoff',
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXDES-300') {
      return fulfillJson({
        key: 'UXDES-300',
        fields: {
          summary: 'Shared UXDES spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXRAW-400') {
      return fulfillJson({
        key: 'UXRAW-400',
        fields: {
          summary: 'Raw text fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXMULTI-500') {
      return fulfillJson({
        key: 'UXMULTI-500',
        fields: {
          summary: 'Mixed raw key fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXCLOUD-600') {
      return fulfillJson({
        key: 'UXCLOUD-600',
        fields: {
          summary: 'Cloud URL fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXQUERY-700') {
      return fulfillJson({
        key: 'UXQUERY-700',
        fields: {
          summary: 'Query selected issue fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXQUERY-701') {
      return fulfillJson({
        key: 'UXQUERY-701',
        fields: {
          summary: 'Mixed path query fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/issue/UXJQL-800') {
      return fulfillJson({
        key: 'UXJQL-800',
        fields: {
          summary: 'JQL filtered issue fallback UX spec',
          issuetype: { name: 'Story' },
          status: { name: 'To Do' },
          customfield_21233: null,
          customfield_11450: null,
          duedate: null,
          fixVersions: [],
        },
      });
    }

    if (pathname === '/rest/api/2/search') {
      return fulfillJson({ issues: [] });
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fields: {} }),
    });
  });

  const page = await context.newPage();
  await page.goto('https://jira.ringcentral.com/browse/ABC-123/');
  await page.waitForSelector('.design-links-container', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.design-link-item').length === 16,
    null,
    { timeout: 20000 },
  );

  const itemTexts = await page.locator('.design-link-item').allTextContents();
  const missingLinkStatusPattern = /Missing link|Missing design link|缺少设计稿链接/;
  const designUpdatedStatusPattern = /Design updated|设计已更新/;
  const updatedDateMissingPattern = /Updated date missing|更新时间缺失/;
  const notReadyStatusPattern = /Not ready for dev|尚未可开发|未准备好/;
  const recoveryBoundaryPattern = /Read-only recovered|只读恢复/;
  const sourceSummary = '16 entries · Remote link, Jira Designs, Linked issue, Description';
  const updateReviewSummary = '5 design update signals; latest 2026-05-21; latest source Object date; 1 missing update time';
  const filteredSummary = '6 filtered non-handoff refs';
  const filteredSourceSummary = 'Design field 1, Description 5';
  const filteredReasonSummary = 'Figma Community 2, Figma documentation 1, Zeplin documentation or marketing page 1, Zeplin app non-project page 1, Zeplin non-resource project page 1';
  const recoverySummary = '5 recovered UX ticket candidates';
  const recoverySourceSummary = '2 selectedIssue query, 1 JQL query, 1 data-issue-key, 1 ARIA label';
  const recoveryFilterSummary = '2 non-design candidates ignored';
  const recoveryFilterSourceSummary = '1 Jira issue URL, 1 ARIA label';
  const scanBasisSummary = `Jira-visible handoff scan: ${sourceSummary}; ${filteredSummary}`;
  assert.equal(
    await page.locator('.design-links-container').getAttribute('aria-label'),
    `Design context: ${scanBasisSummary}; ${updateReviewSummary}; filtered sources ${filteredSourceSummary}; filtered reasons ${filteredReasonSummary}; 1 design-field non-handoff ref; ${recoverySummary}; sources ${recoverySourceSummary}; ${recoveryFilterSummary}; filtered candidate sources ${recoveryFilterSourceSummary}`,
    'design panel should expose a compact source summary to assistive tech',
  );
  assert.match(await page.locator('.design-links-footer .footer-text').textContent(), /16 entries · Remote link, Jira Designs, Linked issue, Description/);
  const scanBasisRow = page.locator('.design-scan-basis-row');
  assert.equal(await scanBasisRow.count(), 1, 'design panel should show a first-screen scan-basis receipt');
  assert.match(
    await scanBasisRow.textContent(),
    /Scan basis|扫描口径/,
    'scan-basis receipt should be visible before status/filter/recovery rows',
  );
  assert.match(
    await scanBasisRow.textContent(),
    /Jira-visible handoff entries|Jira 可见交付入口/,
    'scan-basis receipt should frame rows as Jira-visible handoff entries',
  );
  assert.equal(
    await scanBasisRow.locator('.design-source-basis-tag').textContent(),
    sourceSummary,
    'scan-basis receipt should keep source-channel summary visible without hovering',
  );
  assert.equal(
    await scanBasisRow.locator('.filtered-design-tag').textContent(),
    filteredSummary,
    'scan-basis receipt should keep filtered non-handoff count visible before the footer',
  );
  assert.match(
    await scanBasisRow.getAttribute('aria-label'),
    /only uses links visible in this Jira page and read-only Jira APIs.*does not refresh Figma or Zeplin.*create or edit Jira links.*mark design review complete/,
    'scan-basis receipt should not imply a live Figma or Zeplin inventory or writeback',
  );
  const updateReviewScopeRow = page.locator('.design-update-review-scope-row');
  assert.equal(await updateReviewScopeRow.count(), 1, 'rows with updated timestamps should show a visible review-scope receipt');
  assert.match(
    await updateReviewScopeRow.textContent(),
    /Review scope|复查范围/,
    'review-scope receipt should be visible before users inspect each updated row',
  );
  assert.match(
    await updateReviewScopeRow.textContent(),
    /5 条更新时间信号/,
    'review-scope receipt should count dated update signals plus updated rows missing timestamps',
  );
  assert.match(
    await updateReviewScopeRow.textContent(),
    /最新 2026-05-21/,
    'review-scope receipt should surface the newest usable design update date',
  );
  assert.match(
    await updateReviewScopeRow.textContent(),
    /(最新来源\s+(Object date|对象日期)|Latest source\s+Object date)/,
    'review-scope receipt should expose the metadata basis for the newest update date',
  );
  assert.match(
    await updateReviewScopeRow.textContent(),
    /1 条缺时间/,
    'review-scope receipt should keep missing updated-time rows visible',
  );
  assert.match(
    await updateReviewScopeRow.textContent(),
    /只读提示/,
    'review-scope receipt should label itself as a read-only prompt, not an action',
  );
  assert.match(
    await updateReviewScopeRow.getAttribute('aria-label'),
    /does not refresh Figma, edit Jira, or confirm that the design update was reviewed/,
    'review-scope receipt should preserve refresh/write/review boundaries for assistive tech',
  );
  assert.match(
    await updateReviewScopeRow.locator('.design-scan-boundary-tag').getAttribute('title'),
    /only highlights Jira\/Figma metadata.*does not refresh Figma, edit Jira, or confirm/,
    'review-scope receipt should not imply a live refresh or review confirmation',
  );
  const recoveryScopeRow = page.locator('.design-recovery-scope-row');
  assert.equal(await recoveryScopeRow.count(), 1, 'mixed standard and recovered UX keys should show a visible recovery-scope receipt');
  assert.match(
    await recoveryScopeRow.textContent(),
    /Recovery scope|恢复范围/,
    'recovery-scope receipt should be visible before users inspect each recovered row',
  );
  assert.match(
    await recoveryScopeRow.textContent(),
    /5 recovered UX ticket candidates/,
    'recovery-scope receipt should keep the recovered candidate count visible',
  );
  assert.match(
    await recoveryScopeRow.textContent(),
    /2 selectedIssue query, 1 JQL query, 1 data-issue-key, 1 ARIA label/,
    'recovery-scope receipt should show the actual source distribution for recovered keys',
  );
  assert.match(
    await recoveryScopeRow.textContent(),
    /Read-only candidates|只读候选/,
    'recovery-scope receipt should label recovered keys as candidates rather than confirmed Jira writes',
  );
  assert.match(
    await recoveryScopeRow.getAttribute('aria-label'),
    /selectedIssue query.*JQL query.*data-issue-key.*ARIA label/,
    'recovery-scope receipt should explain the non-standard evidence sources',
  );
  assert.doesNotMatch(
    await recoveryScopeRow.getAttribute('aria-label'),
    /raw text|纯文本/,
    'recovery-scope receipt should not claim raw-text recovery when no raw-text candidate was selected',
  );
  assert.equal(
    await recoveryScopeRow.locator('.ux-key-source-breakdown-tag').textContent(),
    `来源 ${recoverySourceSummary}`,
    'recovery-scope receipt should keep actual recovery sources visible without opening tooltips',
  );
  assert.equal(
    await recoveryScopeRow.locator('.ux-key-recovery-filter-tag').textContent(),
    recoveryFilterSummary,
    'recovery-scope receipt should show non-design candidates filtered by the design-project gate',
  );
  assert.match(
    await recoveryScopeRow.locator('.ux-key-recovery-filter-tag').getAttribute('title'),
    /2 non-design candidates ignored.*1 Jira issue URL, 1 ARIA label.*不匹配当前设计项目配置/,
    'recovery-scope receipt should explain which candidate sources were ignored',
  );
  assert.match(
    await recoveryScopeRow.locator('.ux-key-recovery-tag').getAttribute('title'),
    /does not create or edit Jira issue links|不(?:会)?创建或编辑 Jira issue links/,
    'recovery-scope receipt should keep the no-write boundary visible',
  );
  const footerFilteredTag = page.locator('.design-links-footer .filtered-design-tag');
  assert.equal(await footerFilteredTag.textContent(), filteredSummary);
  assert.match(
    await footerFilteredTag.getAttribute('title'),
    /Figma Community.*Figma documentation.*Zeplin documentation or marketing page.*Zeplin app non-project page.*Sources: Design field 1, Description 5.*Reasons: Figma Community 2/,
    'filtered receipt should explain design-looking URLs that were intentionally not rendered as handoff rows',
  );
  assert.equal(
    await page.locator('.design-links-footer .filtered-design-source-tag').textContent(),
    `来源 ${filteredSourceSummary}`,
    'filtered footer should keep source distribution visible on hover',
  );
  assert.equal(
    await page.locator('.design-links-footer .filtered-design-reason-tag').textContent(),
    `原因 ${filteredReasonSummary}`,
    'filtered footer should keep reason distribution visible on hover',
  );
  const filterScopeRow = page.locator('.design-filter-scope-row');
  assert.equal(await filterScopeRow.count(), 1, 'mixed handoff and filtered refs should show a visible filter-scope receipt');
  assert.match(
    await filterScopeRow.textContent(),
    /Filter scope|过滤范围/,
    'filter-scope receipt should be visible without hovering the footer',
  );
  assert.match(
    await filterScopeRow.textContent(),
    /Non-handoff design-tool links filtered|非交付设计工具链接已过滤/,
    'filter-scope receipt should distinguish ignored design-tool pages from handoff rows',
  );
  assert.match(
    await filterScopeRow.getAttribute('aria-label'),
    /only development handoff entries are shown|只展示可开发交付入口/,
    'filter-scope receipt should expose the conservative classification boundary to assistive tech',
  );
  assert.equal(
    await filterScopeRow.locator('.filtered-design-source-tag').textContent(),
    `来源 ${filteredSourceSummary}`,
    'filter-scope receipt should expose which scan channels produced filtered refs',
  );
  assert.equal(
    await filterScopeRow.locator('.filtered-design-reason-tag').textContent(),
    `原因 ${filteredReasonSummary}`,
    'filter-scope receipt should expose why non-handoff refs were filtered',
  );
  assert.equal(
    await filterScopeRow.locator('.filtered-design-field-tag').textContent(),
    '设计字段被过滤 1',
    'filter-scope receipt should explicitly say UX design-field refs were scanned but filtered',
  );
  assert.match(
    await filterScopeRow.locator('.filtered-design-field-tag').getAttribute('title'),
    /UX ticket design-field URLs were scanned.*Missing link state.*does not edit Jira design fields/,
    'design-field filtered receipt should explain that filtered field refs are not hidden valid handoff links',
  );
  assert.match(
    await filterScopeRow.locator('.design-scan-boundary-tag').getAttribute('title'),
    /does not create or edit Jira|不创建或编辑 Jira/,
    'filter-scope receipt should preserve the no-write Jira boundary',
  );
  assert.equal(await page.locator('.design-links-header').count(), 0, 'design panel should not render a summary header');
  assert.equal(itemTexts.length, 16, 'description, native Jira Designs, remote, and missing UX design rows should render once each');
  assert.match(itemTexts[0], /Ready checkout prototype/);
  assert.match(itemTexts[0], /UX-100/);
  assert.match(itemTexts[0], /Ready for development/);
  assert.match(itemTexts[0], /(Updated|已更新) 2026-05-19/);
  assert.match(itemTexts[0], /Status time|状态时间/);
  assert.match(itemTexts[0], /Cancelled/);
  assert.match(itemTexts[0], /Linked issue/);
  assert.match(itemTexts[0], /Remote link/);
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.design-updated-tag').getAttribute('aria-label'),
    /2026-05-19 12:34 UTC.*Source: Jira\/Figma status updated time/,
    'updated timestamp should expose the latest valid remote metadata time to assistive tech',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.design-updated-tag').getAttribute('title'),
    /2026-05-19 12:34 UTC.*Re-check the linked design if implementation started before this update.*Source: Jira\/Figma status updated time/,
    'updated timestamp tooltip should explain why the date matters',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.design-updated-basis-tag').getAttribute('title'),
    /Status time.*does not refresh Figma, edit Jira, or confirm that the design update was reviewed/,
    'updated timestamp basis should be visible and keep refresh/write/review boundaries explicit',
  );
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.source-tag').textContent(),
    'Remote link, Linked issue',
    'merged source tags should show the most authoritative design source first',
  );
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.source-tag').getAttribute('title'),
    'Source: Remote link, Linked issue',
    'source tag tooltip should not expose internal source keys',
  );
  assert.equal((itemTexts[0].match(/UX-100/g) || []).length, 1, 'UX epic key should not render twice');
  assert.match(itemTexts[1], /Day precision handoff/);
  assert.match(itemTexts[1], designUpdatedStatusPattern);
  assert.match(itemTexts[1], /(Updated|已更新) 2026-05-21/);
  assert.match(itemTexts[1], /Object date|对象日期/);
  assert.match(itemTexts[1], /Remote link/);
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Day precision handoff' }).locator('.design-updated-tag').getAttribute('aria-label'),
    /reported on 2026-05-21.*Source did not provide a specific time.*re-check the linked design.*Source: Jira object updated date/i,
    'date-only metadata should stay day-level in assistive text',
  );
  assert.doesNotMatch(
    await page.locator('.design-link-item', { hasText: 'Day precision handoff' }).locator('.design-updated-tag').getAttribute('title'),
    /00:00 UTC/,
    'date-only metadata should not be presented as an exact UTC timestamp',
  );
  assert.match(itemTexts[2], /Settings fallback handoff/);
  assert.match(itemTexts[2], designUpdatedStatusPattern);
  assert.match(itemTexts[2], /(Updated|已更新) 2026-05-20/);
  assert.match(itemTexts[2], /Object time|对象时间/);
  assert.match(itemTexts[2], /Remote link/);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'Settings fallback handoff' }).locator('.design-link').getAttribute('href'),
    'https://www.figma.com/design/global789/Settings?node-id=5-6',
    'remote link fallback should recover encoded design URLs from globalId',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Settings fallback handoff' }).locator('.design-updated-tag').getAttribute('title'),
    /Source: Jira object updated date/,
    'globalId fallback rows should keep the source of the selected updated date',
  );
  assert.match(itemTexts[3], /Native pricing handoff/);
  assert.match(itemTexts[3], designUpdatedStatusPattern);
  assert.match(itemTexts[3], updatedDateMissingPattern);
  assert.match(itemTexts[3], /Jira Designs/);
  assert.doesNotMatch(itemTexts[3], /Open in Figma/);
  assert.equal(
    (await page.locator('.design-link-item', { hasText: 'Jira Designs' }).locator('.design-link').textContent()).replace(/\s+/g, ' ').trim(),
    'Native pricing handoff ↗',
    'native Jira Designs card title should not include status or CTA text',
  );
  assert.match(itemTexts[4], /UX-200/);
  assert.doesNotMatch(itemTexts[4], /Missing design spec/);
  assert.match(itemTexts[4], missingLinkStatusPattern);
  assert.match(
    await filterScopeRow.getAttribute('aria-label'),
    /设计字段已扫描但只包含非交付链接时，仍保留 Missing link/,
    'filter-scope receipt should connect filtered UX design-field refs to the visible Missing link state',
  );
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UX-200' }).locator('.ux-ticket-link').getAttribute('title'),
    await page.locator('.design-link-item', { hasText: 'UX-200' }).locator('.ux-ticket-link').getAttribute('aria-label'),
    'UX ticket link title and aria-label should carry the same pre-click open boundary',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'UX-200' }).locator('.ux-ticket-link').getAttribute('title'),
    /UX-200.*目标：UX-200.*Linked issue.*Figma\/Jira.*Memory Service/s,
    'missing-design UX ticket link should say opening the ticket is read-only and does not refresh/write before click',
  );
  assert.match(itemTexts[5], /UXDES-300/);
  assert.doesNotMatch(itemTexts[5], /Shared UXDES spec/);
  assert.match(itemTexts[5], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXDES-300' }).locator('.ux-ticket-link').getAttribute('title'),
    await page.locator('.design-link-item', { hasText: 'UXDES-300' }).locator('.ux-ticket-link').getAttribute('aria-label'),
    'UXDES ticket link title and aria-label should carry the same pre-click open boundary',
  );
  assert.match(itemTexts[6], /UXRAW-400/);
  assert.match(itemTexts[6], /Key from data-issue-key/);
  assert.match(itemTexts[6], recoveryBoundaryPattern);
  assert.doesNotMatch(itemTexts[6], /Raw text fallback UX spec/);
  assert.match(itemTexts[6], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXRAW-400' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXRAW-400',
  );
  assert.match(itemTexts[7], /UXMULTI-500/);
  assert.match(itemTexts[7], /Key from ARIA label/);
  assert.match(itemTexts[7], recoveryBoundaryPattern);
  assert.doesNotMatch(itemTexts[7], /ABC-999/);
  assert.match(itemTexts[7], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXMULTI-500' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXMULTI-500',
  );
  assert.match(itemTexts[8], /UXCLOUD-600/);
  assert.doesNotMatch(itemTexts[8], /Open design dependency/);
  assert.match(itemTexts[8], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXCLOUD-600' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXCLOUD-600',
  );
  assert.doesNotMatch(itemTexts[8], /Key from/);
  assert.match(itemTexts[9], /UXQUERY-700/);
  assert.match(itemTexts[9], /Key from selectedIssue query/);
  assert.match(itemTexts[9], recoveryBoundaryPattern);
  assert.doesNotMatch(itemTexts[9], /Query selected issue fallback UX spec/);
  assert.match(itemTexts[9], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXQUERY-700' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXQUERY-700',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'UXQUERY-700' }).locator('.ux-ticket-link').getAttribute('title'),
    /UXQUERY-700.*Key from selectedIssue query.*(does not create or edit Jira issue links|不(?:会)?创建或编辑 Jira issue links).*Figma\/Jira.*Memory Service/s,
    'recovered UX ticket link title should preserve the recovered-candidate boundary before click',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'UXQUERY-700' }).locator('.ux-key-source-tag').getAttribute('title'),
    /standard \/browse\/KEY linked issue URL.*selectedIssue query.*configured design project/,
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'UXQUERY-700' }).locator('.ux-key-recovery-tag').getAttribute('title'),
    /does not create or edit Jira issue links|不会创建或编辑 Jira issue links/,
    'recovered query-key rows should explain that Personal AI did not write Jira relationships',
  );
  assert.match(itemTexts[10], /UXQUERY-701/);
  assert.match(itemTexts[10], /Key from selectedIssue query/);
  assert.match(itemTexts[10], recoveryBoundaryPattern);
  assert.doesNotMatch(itemTexts[10], /ABC-123/);
  assert.doesNotMatch(itemTexts[10], /Mixed path query fallback UX spec/);
  assert.match(itemTexts[10], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXQUERY-701' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXQUERY-701',
  );
  assert.match(itemTexts[11], /UXJQL-800/);
  assert.match(itemTexts[11], /Key from JQL query/);
  assert.match(itemTexts[11], recoveryBoundaryPattern);
  assert.doesNotMatch(itemTexts[11], /JQL filtered issue fallback UX spec/);
  assert.match(itemTexts[11], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXJQL-800' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXJQL-800',
  );
  assert.match(itemTexts[12], /Draft onboarding walkthrough/);
  assert.match(itemTexts[12], notReadyStatusPattern);
  assert.match(itemTexts[12], /(Updated|已更新) 2026-05-17/);
  assert.match(itemTexts[13], /Checkout mobile handoff/);
  assert.match(itemTexts[13], /Description/);
  assert.match(itemTexts[14], /Miro board/);
  assert.match(itemTexts[15], /Zeplin screen/);
  assert.match(itemTexts[15], /Description/);
  assert.equal(
    await page.locator('.design-link[href="https://miro.com/pricing"]').count(),
    0,
    'Miro marketing pages should not render as design handoff links',
  );
  assert.equal(
    await page.locator('.design-link[href^="https://www.loom.com/blog/"]').count(),
    0,
    'Loom blog pages should not render as design handoff links',
  );
  assert.equal(
    await page.locator('.design-readiness, .design-readiness-action, .design-status-summary-chip').count(),
    0,
    'design panel should render ticket rows directly without a top summary or primary action',
  );

  const firstHref = await page.locator('.design-link').first().getAttribute('href');
  assert.equal(firstHref, 'https://www.figma.com/proto/remote123/Checkout');
  const readyDesignLink = page.locator('.design-link', { hasText: 'Ready checkout prototype' }).first();
  const readyDesignTitle = await readyDesignLink.getAttribute('title');
  assert.match(
    readyDesignTitle,
    /Ready checkout prototype.*www\.figma\.com.*Remote link, Linked issue.*2026-05-19.*(Status time|状态时间).*Figma\/Jira.*Memory Service/s,
    'design link title should explain target, source, update context, and no-write/no-refresh boundary before click',
  );
  assert.equal(
    await readyDesignLink.getAttribute('aria-label'),
    readyDesignTitle,
    'design link aria-label should mirror the pre-click open boundary',
  );
  const descriptionHref = await page.locator('.design-link[href^="https://www.figma.com/design/abc123"]').first().getAttribute('href');
  assert.equal(descriptionHref, 'https://www.figma.com/design/abc123/Spec?node-id=1-2');
  assert.equal(await page.locator('.design-open-receipt').isHidden(), true, 'open receipt should stay hidden before a panel link is opened');
  const [openedDesignPage] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.design-link', { hasText: 'Ready checkout prototype' }).first().click(),
  ]);
  await openedDesignPage.close();
  await page.locator('.design-open-receipt', { hasText: '来源打开回执' }).waitFor({ timeout: 5000 });
  const designOpenReceiptText = await page.locator('.design-open-receipt').textContent();
  assert.match(
    designOpenReceiptText,
    /来源打开回执/,
    'opening a design link should leave a visible local receipt on the Jira page',
  );
  assert.match(
    designOpenReceiptText,
    /已打开 设计入口：Ready checkout prototype/,
    'design-open receipt should name the opened design target',
  );
  assert.match(
    designOpenReceiptText,
    /目标 www\.figma\.com/,
    'design-open receipt should show the external host that was opened',
  );
  assert.match(
    designOpenReceiptText,
    /Remote link, Linked issue/,
    'design-open receipt should keep the source channel visible after the click',
  );
  assert.match(
    designOpenReceiptText,
    /待复查 2026-05-19/,
    'design-open receipt should keep the clicked row update date visible after navigation',
  );
  assert.match(
    designOpenReceiptText,
    /更新时间来源\s+(Status time|状态时间)/,
    'design-open receipt should keep the clicked row time-basis visible after navigation',
  );
  assert.match(
    designOpenReceiptText,
    /打开后仍需复查设计/,
    'design-open receipt should say opening the link is not a review confirmation',
  );
  assert.match(
    designOpenReceiptText,
    /只读打开/,
    'design-open receipt should label the click as a read-only open action',
  );
  assert.match(
    await page.locator('.design-open-receipt').getAttribute('aria-label'),
    /打开后仍需复查设计.*不会把这次点击标记为已核对最新更新.*不会刷新 Figma\/Jira 元数据.*标记设计已复查.*创建或编辑 Jira 关联.*Memory Service/,
    'design-open receipt should not imply review confirmation, refresh, Jira writes, or Memory Service writes',
  );
  const [openedUxPage] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.design-link-item', { hasText: 'UXQUERY-700' }).locator('.ux-ticket-link').click(),
  ]);
  await openedUxPage.close();
  const uxOpenReceiptText = await page.locator('.design-open-receipt').textContent();
  assert.match(
    uxOpenReceiptText,
    /已打开 UX ticket：UXQUERY-700/,
    'opening a recovered UX ticket should replace the receipt with the current target',
  );
  assert.match(
    uxOpenReceiptText,
    /目标 UXQUERY-700/,
    'UX-ticket open receipt should show the ticket key instead of a vague Jira host',
  );
  assert.match(
    uxOpenReceiptText,
    /只读打开/,
    'UX-ticket open receipt should keep the read-only boundary visible',
  );
  assert.match(
    uxOpenReceiptText,
    /Key from selectedIssue query/,
    'opening a recovered UX-ticket candidate should keep the recovery source visible in the open receipt',
  );
  assert.match(
    uxOpenReceiptText,
    /恢复候选打开/,
    'opening a recovered UX-ticket candidate should label the click as a recovered-candidate open',
  );
  assert.match(
    uxOpenReceiptText,
    /does not create or edit Jira issue links|不会创建或编辑 Jira issue links/,
    'recovered UX-ticket open receipt should repeat the no-Jira-write boundary',
  );
  assert.match(
    await page.locator('.design-open-receipt').getAttribute('aria-label'),
    /selectedIssue query.*does not create or edit Jira issue links|selectedIssue query.*不会创建或编辑 Jira issue links/,
    'recovered UX-ticket open receipt aria label should preserve recovery source and candidate boundary',
  );
  assert.doesNotMatch(
    uxOpenReceiptText,
    /待复查 2026-05-19/,
    'UX-ticket open receipt should replace the previous design update context instead of leaving stale chips',
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => {
    const container = document.querySelector('.design-links-container');
    const footer = document.querySelector('.design-links-footer');
    if (!container) return false;
    const styles = getComputedStyle(container);
    const matrix = new DOMMatrixReadOnly(styles.transform);
    const footerOpacity = footer ? Number(getComputedStyle(footer).opacity) : 0;
    return Math.abs(matrix.m42) < 0.1 && footerOpacity < 0.01;
  }, null, { timeout: 2000 });

  const statusClass = await page.locator('.design-status-tag').first().getAttribute('class');
  assert.match(statusClass, /design-status-tag--ready/);
  assert.equal(await page.locator('.design-link-item[data-design-attention="ready"]').count(), 1);
  assert.equal(await page.locator('.design-link-item[data-design-attention="updated"]').count(), 3);
  assert.equal(await page.locator('.design-link-item[data-design-attention="missing"]').count(), 8);
  assert.equal(await page.locator('.design-link-item[data-design-attention="not-ready"]').count(), 1);
  assert.equal(await page.locator('.design-link-item[data-design-attention="neutral"]').count(), 3);
  const readyItemStyles = await page.locator('.design-link-item[data-design-attention="ready"]').evaluate(element => {
    const styles = getComputedStyle(element);
    return {
      borderLeftColor: styles.borderLeftColor,
      backgroundColor: styles.backgroundColor,
    };
  });
  assert.notEqual(readyItemStyles.borderLeftColor, 'rgba(0, 0, 0, 0)');
  assert.notEqual(readyItemStyles.backgroundColor, 'rgba(0, 0, 0, 0)');
  const missingStatusTags = page.locator('.design-link-item[data-design-attention="missing"] .design-status-tag');
  assert.equal(await missingStatusTags.count(), 8, 'missing UX rows should show a missing status even when parsed from raw text, Jira issue URLs, selectedIssue query URLs, or JQL query URLs');
  assert.equal(await page.locator('.design-link-item .ux-key-source-tag').count(), 5, 'only non-standard key recovery paths should show key-source receipts');
  assert.equal(await page.locator('.design-link-item .ux-key-recovery-tag').count(), 5, 'only non-standard key recovery paths should show read-only recovery boundary receipts');
  const missingStatusClass = await missingStatusTags.first().getAttribute('class');
  assert.match(missingStatusClass, /design-status-tag--missing/);
  assert.match(
    await missingStatusTags.first().getAttribute('title'),
    /no handoff URL is available.*add or check the design link before implementing/,
    'missing UX rows should explain the recovery action rather than only naming the status',
  );
  const notReadyStatusClass = await page.locator('.design-status-tag', { hasText: notReadyStatusPattern }).getAttribute('class');
  assert.match(notReadyStatusClass, /design-status-tag--not-ready/);
  const updatedStatusClass = await page.locator('.design-status-tag', { hasText: designUpdatedStatusPattern }).first().getAttribute('class');
  assert.match(updatedStatusClass, /design-status-tag--updated/);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'Native pricing handoff' }).locator('.design-updated-missing-tag').textContent(),
    '更新时间缺失',
    'updated native Jira Designs rows without usable timestamps should show a visible missing-date receipt',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Native pricing handoff' }).locator('.design-updated-missing-tag').getAttribute('title'),
    /没有提供可用更新时间|did not provide a usable updated time/,
    'missing-date receipt should explain that the source omitted the usable timestamp',
  );
  assert.equal(
    await page.locator('.design-updated-missing-tag').count(),
    1,
    'only updated rows without valid timestamps should show the missing-date receipt',
  );
  assert.equal(
    await page.locator('.design-updated-basis-tag').count(),
    4,
    'every visible updated timestamp with source metadata should show its time-basis chip',
  );
  assert.match(
    await page.locator('.design-status-tag', { hasText: designUpdatedStatusPattern }).first().getAttribute('title'),
    /Re-check the linked design/,
    'updated status should explain the action implied by Figma/Jira changed state',
  );

  const containerHtml = await page.locator('.design-links-container').innerHTML();
  assert.equal(containerHtml.includes('notfigma.com'), false);
  assert.equal(containerHtml.includes('community/plugin'), false);
  assert.equal(containerHtml.includes('help.figma.com'), false);
  assert.equal(containerHtml.includes('zeplin.io/integrations'), false);
  assert.equal(containerHtml.includes('app.zeplin.io/profile'), false);
  assert.equal(containerHtml.includes('app.zeplin.io/project/abc/settings'), false);

  const transformBeforeHoverY = await page.locator('.design-links-container').evaluate(element => {
    const styles = getComputedStyle(element);
    return new DOMMatrixReadOnly(styles.transform).m42;
  });
  assert.ok(Math.abs(transformBeforeHoverY) < 0.1, 'design links panel should not shift page content');

  const footerBeforeHover = await page.locator('.design-links-footer').evaluate(element => {
    const styles = getComputedStyle(element);
    return {
      justifyContent: styles.justifyContent,
      opacity: styles.opacity,
      position: styles.position,
      transform: styles.transform,
    };
  });
  assert.equal(footerBeforeHover.justifyContent, 'space-between');
  assert.ok(Number.parseFloat(footerBeforeHover.opacity) < 0.01, 'footer should be visually hidden before hover');
  assert.equal(footerBeforeHover.position, 'absolute');
  assert.notEqual(footerBeforeHover.transform, 'none');

  await page.hover('.design-links-container');
  await page.waitForFunction(() => {
    const footer = document.querySelector('.design-links-footer');
    return footer && getComputedStyle(footer).opacity === '1';
  }, null, { timeout: 2000 });
  const footerAfterHover = await page.locator('.design-links-footer').evaluate(element => {
    const styles = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(styles.transform);
    return {
      opacity: styles.opacity,
      transform: styles.transform,
      translateY: matrix.m42,
    };
  });
  assert.equal(footerAfterHover.opacity, '1');
  assert.ok(Math.abs(footerAfterHover.translateY) < 0.1, 'design footer should slide back to its resting position on hover');
  const containerTransformAfterHover = await page.locator('.design-links-container').evaluate(element => {
    const styles = getComputedStyle(element);
    return new DOMMatrixReadOnly(styles.transform).m42;
  });
  assert.ok(
    containerTransformAfterHover > 3.5 && containerTransformAfterHover < 4.5,
    'design links panel should use the same hover translate as the backend progress card',
  );
  await page.evaluate(() => {
    history.pushState({}, '', '/issues/?jql=project%20%3D%20ABC');
    const marker = document.createElement('span');
    marker.setAttribute('data-navigation-marker', 'non-ticket');
    document.body.appendChild(marker);
  });
  await page.waitForFunction(() => !document.querySelector('.design-links-container'), null, { timeout: 10000 });

  await page.goto('https://jira.ringcentral.com/browse/ABC-123');
  await page.waitForSelector('.design-links-container', { timeout: 10000 });

  await page.evaluate(() => {
    history.pushState({}, '', '/browse/DEF-456');
    const title = document.querySelector('.issue-header-content h1');
    if (title) title.textContent = 'DEF-456 Empty issue';
    const description = document.querySelector('#description-val');
    if (description) description.textContent = 'No design references on this issue.';
    document.querySelector('[data-testid="issue-designs-panel"]')?.remove();
    const linksList = document.querySelector('.links-list');
    if (linksList) linksList.innerHTML = '';
  });

  await page.waitForFunction(() => !document.querySelector('.design-links-container'), null, { timeout: 10000 });

  await page.goto('https://jira.ringcentral.com/browse/GHI-789');
  await page.waitForSelector('.design-links-container', { timeout: 10000 });
  const filteredOnlyText = await page.locator('.design-links-container').textContent();
  assert.match(
    filteredOnlyText,
    /No handoff design entry found|未找到交付设计入口/,
    'filtered-only issues should render an explicit no-handoff receipt',
  );
  assert.match(
    filteredOnlyText,
    /Only filtered non-handoff links|仅过滤非交付链接/,
    'filtered-only receipt should distinguish ignored design-tool pages from handoff links',
  );
  assert.match(
    filteredOnlyText,
    /4 filtered non-handoff refs/,
    'filtered-only receipt should keep the ignored design-looking URL count visible',
  );
  assert.match(
    filteredOnlyText,
    /来源 Remote link 1, Description 3/,
    'filtered-only receipt should show which channels produced filtered refs',
  );
  assert.match(
    filteredOnlyText,
    /原因 Figma Community 1, Figma documentation 1, Zeplin non-resource project page 1, Zeplin app non-project page 1/,
    'filtered-only receipt should show why refs were filtered',
  );
  assert.match(
    filteredOnlyText,
    /Read-only scan|只读扫描/,
    'filtered-only receipt should preserve the no-write Jira boundary',
  );
  assert.equal(
    await page.locator('.design-links-container').getAttribute('aria-label'),
    'Design context: Jira-visible handoff scan: 0 handoff entries; 4 filtered non-handoff refs; filtered sources Remote link 1, Description 3; filtered reasons Figma Community 1, Figma documentation 1, Zeplin non-resource project page 1, Zeplin app non-project page 1',
  );
  assert.match(
    await page.locator('.design-scan-basis-row .design-scan-boundary-tag').getAttribute('title'),
    /does not refresh Figma or Zeplin.*create or edit Jira links/,
    'filtered-only scan-basis receipt should keep live-refresh and write boundaries visible',
  );
  assert.match(
    await page.locator('.design-link-item .design-scan-boundary-tag').getAttribute('title'),
    /does not create or edit Jira design links|不创建或编辑 Jira 设计链接/,
  );

  console.log('Jira design links extension E2E passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
