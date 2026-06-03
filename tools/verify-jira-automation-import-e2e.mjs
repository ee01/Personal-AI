import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = process.cwd();
const distPath = path.join(repoRoot, 'dist');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ai-jira-automation-import-'));
const outerUrl = 'https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=TGT';
const innerUrl = 'https://jira.ringcentral.com/secure/AutomationProjectAdminAction!iframe.jspa?projectKey=TGT';

const outerHtml = `<!doctype html>
<html>
  <head><title>Jira Automation Fixture</title></head>
  <body>
    <a id="edit_project" href="/plugins/servlet/project-config/TGT/summary?pid=22222">Project settings</a>
    <iframe class="automation-page-container" src="${innerUrl}" style="width: 1000px; height: 900px;"></iframe>
  </body>
</html>`;

const innerHtml = `<!doctype html>
<html>
  <head><title>Automation Iframe Fixture</title></head>
  <body>
    <main>
      <div role="toolbar">
        <button data-testid="automation-create-rule-button">Create rule</button>
      </div>
      <section data-testid="automation-rules-list">
        <article data-rule-id="existing-1">
          <a href="#/rule/existing-1">Existing rule</a>
        </article>
      </section>
    </main>
  </body>
</html>`;

const exportedRule = {
  name: 'Notify release owner',
  state: 'ENABLED',
  canOtherRuleTrigger: true,
  notifyOnError: 'FIRSTERROR',
  authorAccountId: 'source-owner',
  description: 'Original rule context.',
  trigger: {
    id: 'source-trigger',
    component: 'TRIGGER',
    type: 'jira.jql.scheduled',
    value: {
      schedule: { method: 'CRON' },
      jql: 'project = SRC AND customfield_12345 is not EMPTY AND filter = 98765',
    },
  },
  components: [
    {
      id: 'source-component-1',
      component: 'ACTION',
      type: 'jira.issue.outgoing.webhook',
      value: {
        url: 'https://hooks.example.com/SRC/release/releaseSecretPath1234567890ABCD?apiToken=prod-api-token-123&project=SRC',
        usedSecretsKeys: ['release-webhook-token'],
        recipients: 'release-owner@example.com',
        actorAccountId: 'abc-123-account',
        connectionId: 'prod-webhook-connection',
        authorizationHeader: '*****',
        apiToken: 'prod-api-token-123',
        headers: [
          {
            name: 'Authorization',
            value: {
              secret: true,
              keyOrValue: 'https://hooks.example.com/SRC/hiddenSecretPath1234567890ABCD?token=hidden-secret-token&owner=secret-owner@example.com {{webhookData.hiddenSecret}} project = SRC',
            },
          },
        ],
        body: '{{issue.assignee.accountId}}',
      },
    },
    {
      id: 'source-component-2',
      component: 'ACTION',
      type: 'vendor.release.deployment.action',
      value: {
        deploymentTemplateId: 'release-gate',
      },
    },
  ],
  projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
  labels: ['release'],
};

let createPayload = null;

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 1100 },
  args: [
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`,
  ],
});

try {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        JIRA_API_TOKEN: 'test-token',
        MEETING_PROVIDER_BASE_URL: 'https://meeting-provider.test',
        MEETING_PROVIDER_API_KEY: 'meeting-test-token',
      },
    });
  });

  await context.route(outerUrl, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: outerHtml,
  }));

  await context.route(innerUrl, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: innerHtml,
  }));

  await context.route('https://jira.ringcentral.com/rest/api/2/project/TGT', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: '22222',
      key: 'TGT',
      projectTypeKey: 'software',
    }),
  }));

  await context.route('https://jira.ringcentral.com/rest/api/2/myself', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      key: 'current-owner',
      name: 'current-owner',
      accountId: 'current-owner',
    }),
  }));

  await context.route('https://jira.ringcentral.com/rest/cb-automation/latest/audit/22222**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }));

  await context.route('https://jira.ringcentral.com/rest/cb-automation/latest/project/22222/rule', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      createPayload = JSON.parse(request.postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'new-rule-999' }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'existing-1',
          name: '(Imported by Personal AI) Notify release owner',
          state: 'DISABLED',
          trigger: {},
        },
      ]),
    });
  });

  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', message => {
    consoleMessages.push(`[${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', error => {
    consoleMessages.push(`[pageerror] ${error instanceof Error ? error.message : String(error)}`);
  });
  await page.goto(outerUrl);

  const frame = page.frameLocator('iframe.automation-page-container');
  await frame.locator('#import-rule-button').waitFor({ timeout: 15000 });

  await frame.locator('input[type="file"]').setInputFiles({
    name: 'jira-automation-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ cloud: false, rules: [exportedRule] })),
  });

  await frame.locator('#personal-ai-jira-import-title').waitFor({ timeout: 10000 });
  const previewText = await frame.locator('body').innerText();
  assert.match(previewText, /Disabled import preview/);
  assert.match(previewText, /Imported name/);
  assert.match(previewText, /\(Imported by Personal AI\) Notify release owner \(2\)/);
  assert.match(previewText, /Detected environment bindings/);
  assert.match(previewText, /Custom\/app components/);
  assert.match(previewText, /ACTION: vendor\.release\.deployment\.action/);
  assert.match(previewText, /Enablement checks/);
  assert.match(previewText, /Review note/);
  assert.match(previewText, /Activation plan/);
  assert.match(previewText, /Map target-project search dependencies/);
  assert.match(previewText, /Reconnect external effects and credentials/);
  assert.match(previewText, /Confirm app-provided components are available/);
  assert.match(previewText, /Test dynamic trigger behavior/);
  assert.match(previewText, /Enablement review packet/);
  assert.match(previewText, /Copy review packet/);
  assert.match(previewText, /Secrets/);
  assert.match(previewText, /Authorization: hidden secret value/);
  assert.match(previewText, /Custom fields/);
  assert.match(previewText, /Connections/);
  assert.match(previewText, /Sensitive values/);
  assert.doesNotMatch(previewText, /prod-api-token-123/);
  assert.doesNotMatch(previewText, /releaseSecretPath1234567890ABCD/);
  assert.doesNotMatch(previewText, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(previewText, /hidden-secret-token/);
  assert.doesNotMatch(previewText, /secret-owner@example.com/);
  assert.doesNotMatch(previewText, /webhookData\.hiddenSecret/);
  assert.match(previewText, /\/SRC\/release\/REDACTED\?apiToken=REDACTED/);
  assert.match(previewText, /Smart values/);
  assert.match(previewText, /I reviewed the high-risk bindings before creating this disabled copy/);
  assert.match(previewText, /6 high-risk item\(s\): Target project scope, JQL and filters, Source project references, External effects and credentials, 2 more/);
  assert.match(previewText, /Next: Map target-project search dependencies/);
  assert.match(previewText, /Confirm these before Jira creates the disabled copy/);

  await frame.getByRole('button', { name: 'Copy review packet' }).click();
  await frame.getByText('Review packet copied.').waitFor({ timeout: 5000 });

  const importDisabledCopyButton = frame.getByRole('button', { name: 'Import disabled copy' });
  assert.equal(await importDisabledCopyButton.isDisabled(), true);
  await frame.getByLabel(/I reviewed the high-risk bindings/).check();
  assert.equal(await importDisabledCopyButton.isDisabled(), false);

  await importDisabledCopyButton.focus();
  await importDisabledCopyButton.press('Tab');
  const focusedAfterTab = await frame.locator(':focus').evaluate(element => ({
    tagName: element.tagName,
    type: element.getAttribute('type'),
    inDialog: Boolean(element.closest('[role="dialog"]')),
  }));
  assert.deepEqual(focusedAfterTab, { tagName: 'INPUT', type: 'checkbox', inDialog: true });

  await importDisabledCopyButton.click();
  await page.waitForTimeout(1000);

  if (!createPayload) {
    const afterClickText = await frame.locator('body').innerText();
    throw new Error([
      'Expected Jira Automation create request after confirming import.',
      `Frame text: ${afterClickText}`,
      `Console: ${consoleMessages.join('\n')}`,
    ].join('\n'));
  }

  assert.ok(createPayload, 'expected Jira Automation create payload');
  assert.equal(createPayload.name, '(Imported by Personal AI) Notify release owner (2)');
  assert.equal(createPayload.state, 'DISABLED');
  assert.equal(createPayload.canOtherRuleTrigger, false);
  assert.equal(createPayload.authorAccountId, 'current-owner');
  assert.equal(createPayload.actorAccountId, 'current-owner');
  assert.deepEqual(createPayload.projects, [{ projectId: '22222', projectTypeKey: 'software' }]);
  assert.match(createPayload.description, /Original rule context\./);
  assert.match(createPayload.description, /Personal AI import review/);
  assert.match(createPayload.description, /Imported as a disabled copy into TGT \(22222\)\./);
  assert.match(createPayload.description, /Detected bindings: .*custom field.*connection\/credential/);
  assert.match(createPayload.description, /Top detected bindings: .*JQL \/ filters \(1\): project = SRC/);
  assert.match(createPayload.description, /Activation plan: .*Map target-project search dependencies/);
  assert.match(createPayload.description, /Reconnect external effects and credentials/);
  assert.match(createPayload.description, /Confirm app-provided components are available/);
  assert.match(createPayload.description, /Test dynamic trigger behavior/);
  assert.match(createPayload.description, /Custom \/ app components \(1\): ACTION: vendor\.release\.deployment\.action/);
  assert.match(createPayload.description, /Secrets \(2\): release-webhook-token \| Authorization: hidden secret value/);
  assert.match(createPayload.description, /Connections \(1\): connectionId: prod-webhook-connection/);
  assert.match(createPayload.description, /Sensitive \/ hidden values \(5\): URL query apiToken: sensitive value present \| URL path segment: sensitive value present, 3 more/);
  assert.doesNotMatch(createPayload.description, /prod-api-token-123/);
  assert.doesNotMatch(createPayload.description, /releaseSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayload.description, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayload.description, /hidden-secret-token/);
  assert.doesNotMatch(createPayload.description, /secret-owner@example.com/);
  assert.doesNotMatch(createPayload.description, /webhookData\.hiddenSecret/);
  assert.match(createPayload.description, /\/SRC\/release\/REDACTED\?apiToken=REDACTED/);
  assert.match(createPayload.description, /Detected bindings: .*smart value/);
  assert.match(createPayload.description, /Rule chaining: blocked in imported copy\./);

  console.log('Jira Automation import E2E verification passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
