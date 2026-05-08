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
        <a href="https://www.figma.com/design/abc123/Spec?node-id=1-2">Checkout mobile handoff</a>
        and the pasted URL https://www.figma.com/design/abc123/Spec?node-id=1-2).
        The workshop board is https://miro.com/app/board/uXjVdemo.
        Ignore https://notfigma.com/design/abc.
      </div>
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
  await context.route('https://jira.ringcentral.com/browse/ABC-123', route => {
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
            },
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
  await page.goto('https://jira.ringcentral.com/browse/ABC-123');
  await page.waitForSelector('.design-links-container', { timeout: 10000 });

  const itemTexts = await page.locator('.design-link-item').allTextContents();
  assert.equal(await page.locator('.design-links-header').count(), 0, 'design panel should not render a persistent header');
  assert.equal(itemTexts.length, 6, 'description, remote, and missing UX design rows should render once each');
  assert.match(itemTexts[0], /Ready checkout prototype/);
  assert.match(itemTexts[0], /UX-100/);
  assert.match(itemTexts[0], /Ready for development/);
  assert.match(itemTexts[0], /Cancelled/);
  assert.match(itemTexts[0], /Linked issue/);
  assert.match(itemTexts[0], /Remote link/);
  assert.equal((itemTexts[0].match(/UX-100/g) || []).length, 1, 'UX epic key should not render twice');
  assert.match(itemTexts[1], /UX-200/);
  assert.doesNotMatch(itemTexts[1], /Design link missing/);
  assert.doesNotMatch(itemTexts[1], /Missing design spec/);
  assert.match(itemTexts[1], /Missing link/);
  assert.match(itemTexts[2], /UXDES-300/);
  assert.doesNotMatch(itemTexts[2], /Shared UXDES spec/);
  assert.match(itemTexts[2], /Missing link/);
  assert.match(itemTexts[3], /Draft onboarding walkthrough/);
  assert.match(itemTexts[3], /Not ready for dev/);
  assert.match(itemTexts[4], /Checkout mobile handoff/);
  assert.match(itemTexts[4], /Description/);
  assert.match(itemTexts[5], /Miro board/);

  const firstHref = await page.locator('.design-link').first().getAttribute('href');
  assert.equal(firstHref, 'https://www.figma.com/proto/remote123/Checkout');
  const descriptionHref = await page.locator('.design-link[href^="https://www.figma.com/design/abc123"]').first().getAttribute('href');
  assert.equal(descriptionHref, 'https://www.figma.com/design/abc123/Spec?node-id=1-2');

  const statusClass = await page.locator('.design-status-tag').first().getAttribute('class');
  assert.match(statusClass, /design-status-tag--ready/);
  const missingStatusTags = page.locator('.design-status-tag', { hasText: 'Missing link' });
  assert.equal(await missingStatusTags.count(), 2, 'both missing UX rows should show a missing status');
  const missingStatusClass = await missingStatusTags.first().getAttribute('class');
  assert.match(missingStatusClass, /design-status-tag--missing/);
  const notReadyStatusClass = await page.locator('.design-status-tag', { hasText: 'Not ready for dev' }).getAttribute('class');
  assert.match(notReadyStatusClass, /design-status-tag--not-ready/);

  const containerHtml = await page.locator('.design-links-container').innerHTML();
  assert.equal(containerHtml.includes('notfigma.com'), false);

  const transform = await page.locator('.design-links-container').evaluate(element => {
    return getComputedStyle(element).transform;
  });
  assert.equal(transform, 'none', 'design links panel should not shift page content');

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
    return {
      opacity: styles.opacity,
      transform: styles.transform,
    };
  });
  assert.equal(footerAfterHover.opacity, '1');
  assert.match(footerAfterHover.transform, /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

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
    const linksList = document.querySelector('.links-list');
    if (linksList) linksList.innerHTML = '';
  });

  await page.waitForFunction(() => !document.querySelector('.design-links-container'), null, { timeout: 10000 });

  console.log('Jira design links extension E2E passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
