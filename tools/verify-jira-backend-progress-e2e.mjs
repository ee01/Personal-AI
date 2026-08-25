import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = process.cwd();
const distPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-jira-backend-progress-'));

const fixtureHtml = `<!doctype html>
<html>
  <head><title>RCV-153451 - Jira Backend Progress Fixture</title></head>
  <body>
    <main>
      <section class="issue-header-content"><h1>RCV-153451 Test Epic</h1></section>
      <span id="type-val">Epic</span>
      <div id="description-val">Backend dependency fixture</div>
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

const fulfillJson = (route, data) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

try {
  await context.route('https://jira.ringcentral.com/browse/RCV-153451', route => {
    route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHtml });
  });

  await context.route('https://jira.ringcentral.com/rest/api/2/**', route => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const fields = requestUrl.searchParams.get('fields') || '';

    if (pathname.endsWith('/remotelink')) return fulfillJson(route, []);
    if (pathname === '/rest/api/2/search') {
      return fulfillJson(route, {
        issues: [
          {
            key: 'RCV-153400',
            fields: {
              summary: 'Same-project INIT child must stay filtered',
              issuetype: { name: 'Epic' },
              status: { name: 'Closed' },
            },
          },
          {
            key: 'MTR-147003',
            fields: {
              summary: 'Cross-project INIT child remains eligible',
              issuetype: { name: 'Epic' },
              status: { name: 'Initial' },
            },
          },
        ],
      });
    }

    if (pathname === '/rest/api/2/issue/RCV-153451' && fields.includes('issuelinks,subtasks')) {
      return fulfillJson(route, {
        key: 'RCV-153451',
        fields: {
          subtasks: [],
          issuelinks: [
            {
              type: { name: 'Cloners', outward: 'clones', inward: 'is cloned by' },
              outwardIssue: {
                key: 'RCV-153296',
                fields: {
                  summary: 'Outward clone relationship',
                  status: { name: 'Resolved' },
                },
              },
            },
            {
              type: { name: 'Cloners', outward: 'clones', inward: 'is cloned by' },
              inwardIssue: {
                key: 'RCV-153452',
                fields: {
                  summary: 'Inward clone relationship',
                  status: { name: 'Closed' },
                },
              },
            },
            {
              type: { name: 'Dependency', outward: 'depends on', inward: 'has dependents' },
              outwardIssue: {
                key: 'RCV-159999',
                fields: {
                  summary: 'Cancelled epic link must be hidden',
                  status: { name: 'Cancelled' },
                },
              },
            },
            {
              type: { name: 'Dependency', outward: 'depends on', inward: 'has dependents' },
              outwardIssue: {
                key: 'RCV-152720',
                fields: {
                  summary: 'Same-project direct dependency must be shown',
                  status: { name: 'In Progress' },
                },
              },
            },
          ],
        },
      });
    }
    if (pathname === '/rest/api/2/issue/RCV-153451' && fields.includes('customfield_15751')) {
      return fulfillJson(route, { fields: { customfield_15751: 'INIT-30072' } });
    }
    if (pathname === '/rest/api/2/issue/INIT-30072' && fields.includes('customfield_32651')) {
      return fulfillJson(route, {
        fields: {
          customfield_32651: [{ value: 'RCV' }, { value: 'Apps - mThor' }],
          customfield_19972: JSON.stringify({ RCV: 'Required', 'Apps - mThor': 'Required' }),
          summary: 'Parent INIT fixture',
        },
      });
    }
    if (pathname === '/rest/api/2/issue/INIT-30072' && fields.includes('issuelinks,subtasks')) {
      return fulfillJson(route, {
        key: 'INIT-30072',
        fields: {
          subtasks: [],
          issuelinks: [{
            outwardIssue: {
              key: 'RCV-153400',
              fields: {
                summary: 'Same-project parent issue link must stay filtered',
                issuetype: { name: 'Epic' },
                status: { name: 'Closed' },
              },
            },
          }],
        },
      });
    }
    if (['/rest/api/2/issue/RCV-153296', '/rest/api/2/issue/RCV-153452', '/rest/api/2/issue/RCV-152720'].includes(pathname)) {
      return fulfillJson(route, {
        fields: {
          customfield_18351: pathname.endsWith('RCV-153296')
            ? '2026-08-13'
            : pathname.endsWith('RCV-153452')
              ? '2026-08-08'
              : null,
          customfield_14354: null,
          fixVersions: [],
          status: { name: 'In Progress' },
        },
      });
    }
    if (pathname === '/rest/api/2/issue/MTR-147003') {
      return fulfillJson(route, {
        fields: {
          customfield_18351: '2026-09-15',
          customfield_14354: null,
          fixVersions: [],
          status: { name: 'Initial' },
        },
      });
    }

    return fulfillJson(route, { fields: {} });
  });

  const page = await context.newPage();
  await page.goto('https://jira.ringcentral.com/browse/RCV-153451');
  await page.waitForSelector('.backend-progress-container .backend-progress-item', { timeout: 20_000 });

  const rows = await page.locator('.backend-progress-container .backend-progress-item').allTextContents();
  assert.equal(rows.length, 4);
  assert.match(rows[0], /RCV-153296/);
  assert.match(rows[0], /epic:clones/);
  assert.match(rows[1], /RCV-153452/);
  assert.match(rows[1], /epic:is cloned by/);
  assert.match(rows[2], /RCV-152720/);
  assert.match(rows[2], /epic:depends on/);
  assert.match(rows[3], /MTR-147003/);
  assert.match(rows[3], /parent_impact_layer:Apps - mThor/);
  assert.equal(rows.some(row => row.includes('RCV-153400') || row.includes('RCV-159999')), false);

  console.log('Jira Backend Progress E2E verification passed:', rows.map(row => row.replace(/\s+/g, ' ').trim()));
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
