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
const hiddenSecretPlaceholder = 'PERSONAL_AI_REENTER_SECRET';
const signedUrlSecretPattern = /azure-sas-signature-secret-1234567890|aws-signature-secret-1234567890|aws-session-token-1234567890|AKIAIOSFODNN7EXAMPLE|service-account@example\.iam\.gserviceaccount\.com|azure-function-code-secret-1234567890|apim-subscription-secret-1234567890|ocp-apim-secret-1234567890/;

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
  description: [
    'Original rule context.',
    'clientSecret="desc-client-secret-456"',
    'Authorization: Bearer desc-bearer-secret-789',
    'Webhook https://hooks.example.com/SRC/description/descSecretPath1234567890ABCD?apiToken=desc-api-token-123',
  ].join('\n'),
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
        url: 'https://hooks.example.com/SRC/release/releaseSecretPath1234567890ABCD?apiToken=prod-api-token-123&project=SRC&code=azure-function-code-secret-1234567890&subscription-key=apim-subscription-secret-1234567890&Ocp-Apim-Subscription-Key=ocp-apim-secret-1234567890&sig=azure-sas-signature-secret-1234567890&X-Amz-Signature=aws-signature-secret-1234567890&X-Amz-Security-Token=aws-session-token-1234567890&AWSAccessKeyId=AKIAIOSFODNN7EXAMPLE&GoogleAccessId=service-account@example.iam.gserviceaccount.com',
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
        customBody: '{"clientId":"visible-client-id","clientSecret":"body-client-secret-123","jwt":"body-jwt-secret-456","project":"SRC"}',
        diagnosticBody: 'Authorization: Bearer body-bearer-secret-789 token=body-token-secret-123 project = SRC',
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
  labels: ['release', 'token=label-secret-token-123'],
};

let createPayload = null;
let failedCreatePayload = null;
let createMode = 'failure';
let existingRuleListMode = 'success';
let releaseFirstRuleListLookup = null;
const firstRuleListLookupGate = new Promise(resolve => {
  releaseFirstRuleListLookup = resolve;
});
let holdNextRuleListLookup = true;

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
      personalAiUiPreferences: {
        language: 'en-US',
        updatedAt: Date.now(),
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
      if (createMode === 'failure') {
        failedCreatePayload = JSON.parse(request.postData() || '{}');
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            errorMessages: [
              'Rejected webhook URL https://user:pass@hooks.example.com/SRC/hiddenSecretPath1234567890ABCD?apiToken=prod-api-token-123&owner=secret-owner@example.com#access_token=secret-fragment',
              'Authorization: Bearer sk-prod-secret-should-not-leak',
              'keyOrValue=hidden-secret-token',
            ],
          }),
        });
      }

      createPayload = JSON.parse(request.postData() || '{}');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'new-rule-999' }),
      });
    }

    if (holdNextRuleListLookup) {
      holdNextRuleListLookup = false;
      await firstRuleListLookupGate;
    }

    if (existingRuleListMode === 'failure') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          errorMessages: [
            'Temporary rule-list failure for https://jira.ringcentral.com/rest/cb-automation/latest/project/22222/rule?token=rule-list-secret-123',
          ],
        }),
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

  await frame.getByText(/Preparing disabled-copy preview/).waitFor({ timeout: 5000 });
  const preflightText = await frame.locator('[data-personal-ai-jira-import-preflight="true"]').innerText();
  assert.match(preflightText, /Reading jira-automation-export\.json locally/);
  assert.match(preflightText, /checking target rule names in TGT/);
  assert.match(preflightText, /No Jira create, edit, enable, run, schedule activation, or secret restoration has happened/);
  assert.equal(createPayload, null);
  assert.equal(failedCreatePayload, null);
  releaseFirstRuleListLookup();

  await frame.locator('#personal-ai-jira-import-title').waitFor({ timeout: 10000 });
  await frame.locator('[data-personal-ai-jira-import-preflight="true"]').waitFor({ state: 'detached', timeout: 5000 });
  const previewText = await frame.locator('body').innerText();
  assert.match(previewText, /Disabled import preview/);
  assert.match(previewText, /Current step/);
  assert.match(previewText, /Preview only; no Jira create request has been sent yet/);
  assert.match(previewText, /Create request/);
  assert.match(previewText, /one sanitized POST/);
  assert.match(previewText, /source rule is not edited, enabled, or run/);
  assert.match(previewText, /Reference scope/);
  assert.match(previewText, /Project scope is remapped to the target Jira project, but embedded/);
  assert.match(previewText, /JQL\/filter.*URL.*custom field.*saved filter.*connection\/credential.*account\/recipient.*source project reference.*smart value.*remain review items/);
  assert.match(previewText, /Imported name/);
  assert.match(previewText, /\(Imported by Personal AI\) Notify release owner \(2\)/);
  assert.match(previewText, /Name check/);
  assert.match(previewText, /confirmed against 1 target rule\(s\)/);
  assert.match(previewText, /default imported name already existed/);
  assert.match(previewText, /Source export/);
  assert.match(previewText, /Jira Server\/Data Center export \(cloud=false\)/);
  assert.match(previewText, /Detected environment bindings/);
  assert.match(previewText, /Custom\/app components/);
  assert.match(previewText, /ACTION: vendor\.release\.deployment\.action/);
  assert.match(previewText, /Enablement checks/);
  assert.match(previewText, /Review note/);
  assert.match(previewText, /Activation plan/);
  assert.match(previewText, /Source format compatibility/);
  assert.match(previewText, /Confirm source-format compatibility/);
  assert.match(previewText, /Source export is marked cloud=false/);
  assert.match(previewText, /Map target-project search dependencies/);
  assert.match(previewText, /Reconnect external effects and credentials/);
  assert.match(previewText, /Confirm app-provided components are available/);
  assert.match(previewText, /Test dynamic trigger behavior/);
  assert.match(previewText, /Enablement review packet/);
  assert.match(previewText, /Copy review packet/);
  assert.match(previewText, /Secrets/);
  assert.match(previewText, /Secret re-entry map/);
  assert.match(previewText, /Secret map/);
  assert.match(previewText, /Credential restore gate/);
  assert.match(previewText, /Credential restore gate: open before enablement/);
  assert.match(previewText, /Placeholder or REDACTED values are not working credentials/);
  assert.match(previewText, /description \(description\)/);
  assert.match(previewText, /components\[0\]\.value\.url \(url\)/);
  assert.match(previewText, /components\[0\]\.value\.authorizationHeader \(authorizationHeader\)/);
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
  assert.doesNotMatch(previewText, /desc-client-secret-456/);
  assert.doesNotMatch(previewText, /desc-bearer-secret-789/);
  assert.doesNotMatch(previewText, /descSecretPath1234567890ABCD/);
  assert.doesNotMatch(previewText, /desc-api-token-123/);
  assert.doesNotMatch(previewText, /body-client-secret-123/);
  assert.doesNotMatch(previewText, /body-jwt-secret-456/);
  assert.doesNotMatch(previewText, /body-bearer-secret-789/);
  assert.doesNotMatch(previewText, /body-token-secret-123/);
  assert.doesNotMatch(previewText, /label-secret-token-123/);
  assert.doesNotMatch(previewText, signedUrlSecretPattern);
  assert.match(previewText, /\/SRC\/release\/REDACTED\?apiToken=REDACTED/);
  assert.match(previewText, /sig=REDACTED/);
  assert.match(previewText, /code=REDACTED/);
  assert.match(previewText, /subscription-key=REDACTED/);
  assert.match(previewText, /Ocp-Apim-Subscription-Key=REDACTED/);
  assert.match(previewText, /Smart values/);
  assert.match(previewText, /Import boundary receipt/);
  assert.match(previewText, /High-risk review items were detected\. You can import the disabled copy now, but finish the review in Jira before enabling it/);
  assert.match(previewText, /Source format\s+Jira Server\/Data Center export \(cloud=false\)/);
  assert.match(previewText, /No auto-enable, run, schedule activation, or secret restoration/);
  assert.match(previewText, /Sanitized review note and Activation plan stay in the Jira description/);
  assert.match(previewText, /Open the imported rule details, re-enter hidden secrets, test manually, then enable in Jira/);
  assert.match(previewText, /7 high-risk item\(s\): Target project scope, Source format compatibility, JQL and filters, Source project references, 3 more/);
  assert.match(previewText, /Next: Confirm source-format compatibility/);
  assert.match(previewText, /You can import the disabled copy now; complete these checks in Jira before enabling the rule/);
  assert.match(previewText, /Import is available now; the imported copy will remain disabled until you enable it in Jira/);
  assert.match(previewText, /Create-stage ready: direct import is allowed; Jira-side Activation plan review remains open before enablement/);
  assert.doesNotMatch(previewText, /I understand this only creates a disabled copy/);
  assert.match(previewText, /Copy the sanitized checklist and detected bindings before you leave the preview\. This is a handoff packet, not an approval/);
  assert.match(previewText, /Clipboard only\s+Copy writes a sanitized local clipboard packet for review handoff/);
  assert.match(previewText, /Does not\s+It does not create or edit Jira rules, enable automation, run schedules, or restore secrets/);
  assert.doesNotMatch(previewText, /Confirm these before Jira creates the disabled copy/);

  await frame.getByRole('button', { name: 'Copy review packet' }).click();
  await frame.getByText(/Review packet copied to local clipboard only; no Jira create, enable, run, or secret restore happened/).waitFor({ timeout: 5000 });

  const importDisabledCopyButton = frame.getByRole('button', { name: 'Import disabled copy' });
  const headerImportButton = frame.getByRole('button', { name: 'Create disabled Jira copy from dialog header' });
  const chainedTriggerSafeguard = frame.getByLabel(/Prevent other automation rules from triggering this imported copy/);
  assert.equal(await importDisabledCopyButton.isDisabled(), false);
  assert.equal(await headerImportButton.isDisabled(), false);

  await chainedTriggerSafeguard.uncheck();
  assert.equal(await importDisabledCopyButton.isDisabled(), false);
  assert.equal(await headerImportButton.isDisabled(), false);

  await chainedTriggerSafeguard.check();
  await frame.getByText(/Create-stage ready: direct import is allowed; Jira-side Activation plan review remains open/).waitFor({ timeout: 5000 });
  assert.equal(await importDisabledCopyButton.isDisabled(), false);

  await headerImportButton.focus();
  await headerImportButton.press('Tab');
  const focusedAfterTab = await frame.locator(':focus').evaluate(element => ({
    tagName: element.tagName,
    type: element.getAttribute('type'),
    inDialog: Boolean(element.closest('[role="dialog"]')),
  }));
  assert.deepEqual(focusedAfterTab, { tagName: 'INPUT', type: 'checkbox', inDialog: true });

  await importDisabledCopyButton.click();
  await page.getByText(/Create request pending: sending one sanitized POST/).waitFor({ timeout: 5000 });
  const pendingCreateText = await page.locator('body').innerText();
  assert.match(pendingCreateText, /Create request pending: sending one sanitized POST for "\(Imported by Personal AI\) Notify release owner \(2\)" in TGT/);
  assert.match(pendingCreateText, /Payload state is DISABLED; Jira has not confirmed creation yet/);
  assert.match(pendingCreateText, /Chained triggers are blocked or disabled in the imported copy/);
  assert.match(pendingCreateText, /No auto-enable, run, schedule activation, or secret restoration is happening/);
  await page.getByText(/Jira import failed or could not be confirmed/).waitFor({ timeout: 5000 });
  const failedImportText = await page.locator('body').innerText();
  assert.ok(failedCreatePayload, 'expected failed Jira Automation create payload');
  assert.match(failedImportText, /API call failed: 400 Bad Request/);
  assert.match(failedImportText, /Personal AI did not auto-enable, run, activate schedules, or restore secrets/);
  assert.match(failedImportText, /Check Jira for a disabled copy before retrying/);
  assert.match(failedImportText, /apiToken=REDACTED/);
  assert.match(failedImportText, /Authorization: Bearer REDACTED/);
  assert.match(failedImportText, /keyOrValue=REDACTED/);
  assert.doesNotMatch(failedImportText, /prod-api-token-123/);
  assert.doesNotMatch(failedImportText, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(failedImportText, /secret-fragment/);
  assert.doesNotMatch(failedImportText, /sk-prod-secret-should-not-leak/);
  assert.doesNotMatch(failedImportText, /hidden-secret-token/);
  assert.doesNotMatch(failedImportText, /secret-owner@example.com/);
  assert.doesNotMatch(failedImportText, signedUrlSecretPattern);
  assert.equal(
    failedCreatePayload.components[0].value.headers[0].value.keyOrValue,
    hiddenSecretPlaceholder,
  );
  assert.doesNotMatch(JSON.stringify(failedCreatePayload), signedUrlSecretPattern);
  assert.equal(failedCreatePayload.name, '(Imported by Personal AI) Notify release owner (2)');

  existingRuleListMode = 'failure';
  createMode = 'success';
  await frame.locator('input[type="file"]').setInputFiles({
    name: 'jira-automation-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ cloud: false, rules: [exportedRule] })),
  });
  await frame.locator('#personal-ai-jira-import-title').waitFor({ timeout: 10000 });
  const unconfirmedPreviewText = await frame.locator('body').innerText();
  assert.match(unconfirmedPreviewText, /Target name collision check is not confirmed/);
  assert.match(unconfirmedPreviewText, /Target rule list unavailable; imported name is best-effort/);
  assert.match(unconfirmedPreviewText, /Target rule names could not be read/);
  assert.match(unconfirmedPreviewText, /best-effort disabled-copy name/);
  assert.match(unconfirmedPreviewText, /token=REDACTED/);
  assert.doesNotMatch(unconfirmedPreviewText, /rule-list-secret-123/);
  assert.doesNotMatch(unconfirmedPreviewText, signedUrlSecretPattern);
  assert.doesNotMatch(unconfirmedPreviewText, /\(Imported by Personal AI\) Notify release owner \(2\)/);
  await frame.getByRole('button', { name: 'Import disabled copy' }).click();
  await page.getByText(/Imported disabled copy:/).waitFor({ timeout: 3000 });
  const postImportText = await page.locator('body').innerText();
  assert.match(postImportText, /Imported disabled copy: "\(Imported by Personal AI\) Notify release owner" in TGT/);
  assert.match(postImportText, /Target name collision check was not confirmed before create/);
  assert.match(postImportText, /Source file was cloud=false; confirm format-sensitive web request, app, and credential pieces before enabling/);
  assert.match(postImportText, /No auto-enable, run, schedule activation, or secret restoration happened/);
  assert.match(postImportText, /Re-enter hidden secrets, test manually, then enable in Jira/);
  assert.match(postImportText, /Secret map: \d+ slot\(s\)/);
  assert.match(postImportText, /components\[0\]\.value\.url \(url\)/);
  assert.match(postImportText, /Placeholders are not working credentials/);
  assert.match(postImportText, /Credential restore gate remains open until those fields are re-entered or intentionally left blank in Jira/);
  assert.match(postImportText, /Sanitized review note and Activation plan are in the Jira description/);
  assert.match(postImportText, /First check: Confirm source-format compatibility/);
  assert.match(postImportText, /Redirecting to the imported rule/);
  assert.doesNotMatch(postImportText, /prod-api-token-123/);
  assert.doesNotMatch(postImportText, /hidden-secret-token/);
  assert.doesNotMatch(postImportText, /secret-owner@example.com/);
  assert.doesNotMatch(postImportText, /body-client-secret-123|desc-client-secret-456|label-secret-token-123/);
  assert.doesNotMatch(postImportText, signedUrlSecretPattern);
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
  const createPayloadText = JSON.stringify(createPayload);
  assert.equal(createPayload.name, '(Imported by Personal AI) Notify release owner');
  assert.equal(createPayload.state, 'DISABLED');
  assert.equal(createPayload.canOtherRuleTrigger, false);
  assert.equal(createPayload.authorAccountId, 'current-owner');
  assert.equal(createPayload.actorAccountId, 'current-owner');
  assert.deepEqual(createPayload.projects, [{ projectId: '22222', projectTypeKey: 'software' }]);
  assert.match(createPayload.description, /Original rule context\./);
  assert.match(createPayload.description, /Personal AI import review/);
  assert.match(createPayload.description, /Imported as a disabled copy into TGT \(22222\)\./);
  assert.match(createPayload.description, /Name collision check: not confirmed/);
  assert.match(createPayload.description, /best-effort disabled-copy name/);
  assert.match(createPayload.description, /Secret re-entry map: \d+ slot\(s\)/);
  assert.match(createPayload.description, /Credential restore gate: open before enablement/);
  assert.match(createPayload.description, /components\[0\]\.value\.url \(url\)/);
  assert.match(createPayload.description, /token=REDACTED/);
  assert.doesNotMatch(createPayload.description, /rule-list-secret-123/);
  assert.match(createPayload.description, /Source format: Jira Server\/Data Center export \(cloud=false\)\./);
  assert.match(createPayload.description, /High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement/);
  assert.match(createPayload.description, /Create-stage acknowledgement: not required before disabled-copy creation; Personal AI preview showed high-risk review items, and disabled-copy creation is not enablement approval/);
  assert.match(createPayload.description, /Detected bindings: .*custom field.*connection\/credential/);
  assert.match(createPayload.description, /Top detected bindings: .*JQL \/ filters \(2\): project = SRC/);
  assert.match(createPayload.description, /Authorization: Bearer REDACTED token=REDACTED project = SRC/);
  assert.match(createPayload.description, /Activation plan: .*Confirm source-format compatibility/);
  assert.match(createPayload.description, /Map target-project search dependencies/);
  assert.match(createPayload.description, /Reconnect external effects and credentials/);
  assert.match(createPayload.description, /Confirm app-provided components are available/);
  assert.match(createPayload.description, /Test dynamic trigger behavior/);
  assert.match(createPayload.description, /Custom \/ app components \(1\): ACTION: vendor\.release\.deployment\.action/);
  assert.match(createPayload.description, /Secrets \(2\): release-webhook-token \| Authorization: hidden secret value/);
  assert.match(createPayload.description, /Connections \(1\): connectionId: prod-webhook-connection/);
  assert.match(createPayload.description, /Sensitive \/ hidden values \(\d+\): URL query apiToken: sensitive value present \| URL query code: sensitive value present/);
  assert.doesNotMatch(createPayload.description, /prod-api-token-123/);
  assert.doesNotMatch(createPayload.description, /releaseSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayload.description, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayload.description, /hidden-secret-token/);
  assert.doesNotMatch(createPayload.description, /secret-owner@example.com/);
  assert.doesNotMatch(createPayload.description, /webhookData\.hiddenSecret/);
  assert.doesNotMatch(createPayload.description, signedUrlSecretPattern);
  assert.match(createPayload.description, /clientSecret="REDACTED"/);
  assert.match(createPayload.description, /Authorization: Bearer REDACTED/);
  assert.match(createPayload.description, /description\/REDACTED\?apiToken=REDACTED/);
  assert.doesNotMatch(createPayload.description, /desc-client-secret-456/);
  assert.doesNotMatch(createPayload.description, /desc-bearer-secret-789/);
  assert.doesNotMatch(createPayload.description, /descSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayload.description, /desc-api-token-123/);
  assert.match(createPayload.description, /\/SRC\/release\/REDACTED\?apiToken=REDACTED/);
  assert.match(createPayload.description, /code=REDACTED/);
  assert.match(createPayload.description, /subscription-key=REDACTED/);
  assert.match(createPayload.description, /Ocp-Apim-Subscription-Key=REDACTED/);
  assert.match(createPayload.description, /Detected bindings: .*smart value/);
  assert.match(createPayload.description, /Rule chaining: blocked in imported copy\./);
  assert.match(createPayloadText, new RegExp(hiddenSecretPlaceholder));
  assert.doesNotMatch(createPayloadText, /prod-api-token-123/);
  assert.doesNotMatch(createPayloadText, /releaseSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayloadText, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(createPayloadText, /hidden-secret-token/);
  assert.doesNotMatch(createPayloadText, /secret-owner@example.com/);
  assert.doesNotMatch(createPayloadText, /webhookData\.hiddenSecret/);
  assert.doesNotMatch(createPayloadText, /body-client-secret-123/);
  assert.doesNotMatch(createPayloadText, /body-jwt-secret-456/);
  assert.doesNotMatch(createPayloadText, /body-bearer-secret-789/);
  assert.doesNotMatch(createPayloadText, /body-token-secret-123/);
  assert.doesNotMatch(createPayloadText, /label-secret-token-123/);
  assert.doesNotMatch(createPayloadText, signedUrlSecretPattern);
  assert.equal(
    createPayload.components[0].value.url,
    'https://hooks.example.com/SRC/release/REDACTED?apiToken=REDACTED&project=SRC&code=REDACTED&subscription-key=REDACTED&Ocp-Apim-Subscription-Key=REDACTED&sig=REDACTED&X-Amz-Signature=REDACTED&X-Amz-Security-Token=REDACTED&AWSAccessKeyId=REDACTED&GoogleAccessId=REDACTED',
  );
  assert.equal(
    createPayload.components[0].value.authorizationHeader,
    hiddenSecretPlaceholder,
  );
  assert.equal(
    createPayload.components[0].value.apiToken,
    hiddenSecretPlaceholder,
  );
  assert.equal(
    createPayload.components[0].value.headers[0].value.keyOrValue,
    hiddenSecretPlaceholder,
  );
  assert.equal(
    createPayload.components[0].value.customBody,
    `{"clientId":"visible-client-id","clientSecret":"${hiddenSecretPlaceholder}","jwt":"${hiddenSecretPlaceholder}","project":"SRC"}`,
  );
  assert.equal(
    createPayload.components[0].value.diagnosticBody,
    `Authorization: Bearer ${hiddenSecretPlaceholder} token=${hiddenSecretPlaceholder} project = SRC`,
  );
  assert.deepEqual(createPayload.labels, ['release', `token=${hiddenSecretPlaceholder}`]);

  const consoleText = consoleMessages.join('\n');
  assert.doesNotMatch(consoleText, /Importing rule:/);
  assert.doesNotMatch(consoleText, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(consoleText, /hidden-secret-token/);
  assert.doesNotMatch(consoleText, /secret-owner@example.com/);
  assert.doesNotMatch(consoleText, /body-client-secret-123|body-jwt-secret-456|body-bearer-secret-789|body-token-secret-123|label-secret-token-123/);
  assert.doesNotMatch(consoleText, signedUrlSecretPattern);

  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      personalAiUiPreferences: {
        language: 'zh-CN',
        updatedAt: Date.now(),
      },
    });
  });
  await page.goto(outerUrl);
  const zhFrame = page.frameLocator('iframe.automation-page-container');
  await zhFrame.locator('#import-rule-button').waitFor({ timeout: 15000 });
  assert.equal(await zhFrame.locator('#import-rule-button').innerText(), '导入规则');
  await zhFrame.locator('input[type="file"]').setInputFiles({
    name: 'jira-automation-export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ cloud: false, rules: [exportedRule] })),
  });
  await zhFrame.locator('#personal-ai-jira-import-title').waitFor({ timeout: 10000 });
  const zhPreviewText = await zhFrame.locator('body').innerText();
  assert.match(zhPreviewText, /导入 Jira Automation 规则/);
  assert.match(zhPreviewText, /禁用副本导入预览/);
  assert.match(zhPreviewText, /导入边界回执/);
  assert.match(zhPreviewText, /检测到高风险复核项/);
  assert.match(zhPreviewText, /你可以直接导入禁用副本/);
  assert.match(zhPreviewText, /凭据恢复门控/);
  assert.match(zhPreviewText, /启用前仍未完成/);
  assert.match(zhPreviewText, /创建阶段就绪：可直接导入/);
  assert.match(zhPreviewText, /导入禁用副本/);
  assert.doesNotMatch(zhPreviewText, /I understand this only creates a disabled copy/);
  await zhFrame.getByRole('button', { name: '取消' }).click();

  console.log('Jira Automation import E2E verification passed');
} finally {
  await context.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
