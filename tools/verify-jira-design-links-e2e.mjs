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
        </div>
      </div>
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
          customfield_21233: null,
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

  const itemTexts = await page.locator('.design-link-item').allTextContents();
  const missingLinkStatusPattern = /Missing link|缺少设计稿链接/;
  const designUpdatedStatusPattern = /Design updated|设计已更新/;
  const notReadyStatusPattern = /Not ready for dev|尚未可开发|未准备好/;
  const sourceSummary = '11 entries · Remote link, Jira Designs, Linked issue, Description';
  assert.equal(
    await page.locator('.design-links-container').getAttribute('aria-label'),
    `Design context: ${sourceSummary}`,
    'design panel should expose a compact source summary to assistive tech',
  );
  assert.match(await page.locator('.design-links-footer .footer-text').textContent(), /11 entries · Remote link, Jira Designs, Linked issue, Description/);
  assert.equal(await page.locator('.design-links-header').count(), 0, 'design panel should not render a summary header');
  assert.equal(itemTexts.length, 11, 'description, native Jira Designs, remote, and missing UX design rows should render once each');
  assert.match(itemTexts[0], /Ready checkout prototype/);
  assert.match(itemTexts[0], /UX-100/);
  assert.match(itemTexts[0], /Ready for development/);
  assert.match(itemTexts[0], /(Updated|已更新) 2026-05-19/);
  assert.match(itemTexts[0], /Cancelled/);
  assert.match(itemTexts[0], /Linked issue/);
  assert.match(itemTexts[0], /Remote link/);
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.design-updated-tag').getAttribute('aria-label'),
    /2026-05-19 12:34 UTC/,
    'updated timestamp should expose the latest valid remote metadata time to assistive tech',
  );
  assert.match(
    await page.locator('.design-link-item', { hasText: 'Ready checkout prototype' }).locator('.design-updated-tag').getAttribute('title'),
    /2026-05-19 12:34 UTC.*Re-check the linked design if implementation started before this update/,
    'updated timestamp tooltip should explain why the date matters',
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
  assert.match(itemTexts[1], /Native pricing handoff/);
  assert.match(itemTexts[1], designUpdatedStatusPattern);
  assert.match(itemTexts[1], /Jira Designs/);
  assert.doesNotMatch(itemTexts[1], /Open in Figma/);
  assert.equal(
    (await page.locator('.design-link-item', { hasText: 'Jira Designs' }).locator('.design-link').textContent()).replace(/\s+/g, ' ').trim(),
    'Native pricing handoff ↗',
    'native Jira Designs card title should not include status or CTA text',
  );
  assert.match(itemTexts[2], /UX-200/);
  assert.doesNotMatch(itemTexts[2], /Missing design spec/);
  assert.match(itemTexts[2], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UX-200' }).locator('.ux-ticket-link').getAttribute('title'),
    'UX-200',
  );
  assert.match(itemTexts[3], /UXDES-300/);
  assert.doesNotMatch(itemTexts[3], /Shared UXDES spec/);
  assert.match(itemTexts[3], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXDES-300' }).locator('.ux-ticket-link').getAttribute('title'),
    'UXDES-300',
  );
  assert.match(itemTexts[4], /UXRAW-400/);
  assert.doesNotMatch(itemTexts[4], /Raw text fallback UX spec/);
  assert.match(itemTexts[4], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXRAW-400' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXRAW-400',
  );
  assert.match(itemTexts[5], /UXMULTI-500/);
  assert.doesNotMatch(itemTexts[5], /ABC-999/);
  assert.match(itemTexts[5], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXMULTI-500' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXMULTI-500',
  );
  assert.match(itemTexts[6], /UXCLOUD-600/);
  assert.doesNotMatch(itemTexts[6], /Open design dependency/);
  assert.match(itemTexts[6], missingLinkStatusPattern);
  assert.equal(
    await page.locator('.design-link-item', { hasText: 'UXCLOUD-600' }).locator('.ux-ticket-link').getAttribute('href'),
    '/browse/UXCLOUD-600',
  );
  assert.match(itemTexts[7], /Draft onboarding walkthrough/);
  assert.match(itemTexts[7], notReadyStatusPattern);
  assert.match(itemTexts[7], /(Updated|已更新) 2026-05-17/);
  assert.match(itemTexts[8], /Checkout mobile handoff/);
  assert.match(itemTexts[8], /Description/);
  assert.match(itemTexts[9], /Miro board/);
  assert.match(itemTexts[10], /Zeplin screen/);
  assert.match(itemTexts[10], /Description/);
  assert.equal(
    await page.locator('.design-readiness, .design-readiness-action, .design-status-summary-chip').count(),
    0,
    'design panel should render ticket rows directly without a top summary or primary action',
  );

  const firstHref = await page.locator('.design-link').first().getAttribute('href');
  assert.equal(firstHref, 'https://www.figma.com/proto/remote123/Checkout');
  const descriptionHref = await page.locator('.design-link[href^="https://www.figma.com/design/abc123"]').first().getAttribute('href');
  assert.equal(descriptionHref, 'https://www.figma.com/design/abc123/Spec?node-id=1-2');

  const statusClass = await page.locator('.design-status-tag').first().getAttribute('class');
  assert.match(statusClass, /design-status-tag--ready/);
  assert.equal(await page.locator('.design-link-item[data-design-attention="ready"]').count(), 1);
  assert.equal(await page.locator('.design-link-item[data-design-attention="updated"]').count(), 1);
  assert.equal(await page.locator('.design-link-item[data-design-attention="missing"]').count(), 5);
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
  const missingStatusTags = page.locator('.design-status-tag', { hasText: missingLinkStatusPattern });
  assert.equal(await missingStatusTags.count(), 5, 'missing UX rows should show a missing status even when parsed from raw text or Jira issue URLs');
  const missingStatusClass = await missingStatusTags.first().getAttribute('class');
  assert.match(missingStatusClass, /design-status-tag--missing/);
  const notReadyStatusClass = await page.locator('.design-status-tag', { hasText: notReadyStatusPattern }).getAttribute('class');
  assert.match(notReadyStatusClass, /design-status-tag--not-ready/);
  const updatedStatusClass = await page.locator('.design-status-tag', { hasText: designUpdatedStatusPattern }).getAttribute('class');
  assert.match(updatedStatusClass, /design-status-tag--updated/);
  assert.match(
    await page.locator('.design-status-tag', { hasText: designUpdatedStatusPattern }).first().getAttribute('title'),
    /Re-check the linked design/,
    'updated status should explain the action implied by Figma/Jira changed state',
  );

  const containerHtml = await page.locator('.design-links-container').innerHTML();
  assert.equal(containerHtml.includes('notfigma.com'), false);
  assert.equal(containerHtml.includes('community/plugin'), false);

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
  assert.equal(footerBeforeHover.opacity, '0');
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

  console.log('Jira design links extension E2E passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
