import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES,
  JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH,
  JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  buildJiraAutomationImportSecretReentryQueueGroups,
  buildJiraAutomationImportCredentialRestoreGateSummary,
  buildJiraAutomationImportEnablementPlan,
  buildJiraAutomationImportedRuleName,
  buildJiraAutomationImportRule,
  buildJiraAutomationImportReviewFindings,
  buildJiraAutomationImportReviewChecklist,
  buildJiraAutomationImportReviewNote,
  buildJiraAutomationImportNameCheckReceipt,
  buildJiraAutomationImportReviewPacket,
  buildJiraAutomationImportWarnings,
  buildJiraAutomationUniqueImportedRuleName,
  collectJiraAutomationImportSecretReentrySlots,
  collectJiraAutomationImportReviewSignals,
  formatJiraAutomationImportSecretReentryQueue,
  formatJiraAutomationImportSecretReentrySummary,
  formatJiraAutomationImportSourceFormat,
  isJiraAutomationImportFileSizeAllowed,
  parseJiraAutomationExport,
  redactJiraAutomationImportErrorText,
  sanitizeJiraAutomationImportDisplayText,
  summarizeJiraAutomationImportRule,
} from '../transform.js';

const baseRule = {
  name: 'Notify release owner',
  state: 'ENABLED',
  canOtherRuleTrigger: true,
  notifyOnError: 'FIRSTERROR',
  authorAccountId: 'source-owner',
  trigger: {
    id: 'source-trigger',
    type: 'jira.jql.scheduled',
    value: { executionMode: 'nosearch' },
  },
  components: [
    { id: 'source-component-1', type: 'jira.issue.action' },
    { id: 'source-component-2', type: 'jira.notification' },
  ],
  projects: [{ projectId: '11111', projectTypeKey: 'business' }],
  labels: ['release'],
};

test('parseJiraAutomationExport validates exported rule shape', () => {
  assert.equal(parseJiraAutomationExport({ rules: [baseRule], cloud: false }).rules.length, 1);

  assert.throws(() => parseJiraAutomationExport({}), {
    message: 'Invalid JSON format: missing rules array',
  });

  assert.throws(() => parseJiraAutomationExport({ rules: [] }), {
    message: 'No automation rules found in the imported file',
  });
});

test('buildJiraAutomationImportRule remaps project and imports disabled copy', () => {
  const importRule = buildJiraAutomationImportRule(baseRule, {
    projectId: '22222',
    projectTypeKey: 'software',
    ownerId: 'current-owner',
    now: 1777600000000,
  });

  assert.equal(importRule.name, '(Imported by Personal AI) Notify release owner');
  assert.equal(importRule.state, 'DISABLED');
  assert.equal(importRule.canOtherRuleTrigger, false);
  assert.equal(importRule.authorAccountId, 'current-owner');
  assert.equal(importRule.actorAccountId, 'current-owner');
  assert.deepEqual(importRule.projects, [{ projectId: '22222', projectTypeKey: 'software' }]);
  assert.equal(importRule.trigger.id, '__NEW__TRIGGER');
  assert.equal(importRule.components[0].id, '__NEW__COMPONENT__1777600000000');
  assert.equal(importRule.components[1].id, '__NEW__COMPONENT__1777600000001');
  assert.ok(importRule.description?.includes('Rule purpose: Notify release owner.'));
  assert.ok(importRule.description?.includes('a scheduled trigger'));
  assert.ok(importRule.description?.includes('Personal AI import review'));
});

test('buildJiraAutomationImportRule can import enabled when disable-after-import is cleared', () => {
  const importRule = buildJiraAutomationImportRule(baseRule, {
    projectId: '22222',
    disableAfterImport: false,
    now: 1777600000030,
  });

  assert.equal(importRule.state, 'ENABLED');
});

test('buildJiraAutomationImportRule preserves chained rule triggers only when explicitly allowed', () => {
  const importRule = buildJiraAutomationImportRule(baseRule, {
    projectId: '22222',
    projectTypeKey: 'software',
    allowOtherRuleTrigger: true,
    now: 1777600000040,
  });

  assert.equal(importRule.canOtherRuleTrigger, true);
});

test('buildJiraAutomationImportRule can block chained rule triggers for safer UI imports', () => {
  const importRule = buildJiraAutomationImportRule(baseRule, {
    projectId: '22222',
    projectTypeKey: 'software',
    allowOtherRuleTrigger: false,
    now: 1777600000050,
  });

  assert.equal(importRule.canOtherRuleTrigger, false);
  assert.ok(importRule.description?.includes('Rule purpose: Notify release owner.'));
  assert.ok(importRule.description?.includes('Personal AI import review'));
  assert.ok(importRule.description?.includes('Rule chaining: blocked in imported copy.'));
});

test('buildJiraAutomationImportRule preserves source description and appends review note', () => {
  const importRule = buildJiraAutomationImportRule(
    {
      ...baseRule,
      description: 'Existing business context for the release rule.',
      trigger: {
        ...baseRule.trigger,
        value: {
          jql: 'project = SRC AND customfield_12345 is not EMPTY',
        },
      },
      projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    },
    {
      projectId: '22222',
      projectKey: 'TGT',
      projectTypeKey: 'software',
      now: 1777600000060,
    },
  );

  assert.ok(importRule.description?.startsWith('Existing business context for the release rule.\n\nPersonal AI import review'));
  assert.ok(importRule.description?.includes('Imported as a disabled copy into TGT (22222).'));
  assert.ok(importRule.description?.includes('High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement'));
  assert.ok(importRule.description?.includes('Create-stage acknowledgement: not required before disabled-copy creation; Personal AI preview showed high-risk review items, and disabled-copy creation is not enablement approval.'));
  assert.ok(importRule.description?.includes('Top detected bindings: JQL / filters (1): project = SRC'));
});

test('buildJiraAutomationImportReviewNote records completed create-stage acknowledgement as non-enablement approval', () => {
  const note = buildJiraAutomationImportReviewNote(
    {
      ...baseRule,
      trigger: {
        ...baseRule.trigger,
        value: {
          jql: 'project = SRC AND filter = 98765',
        },
      },
      projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    },
    {
      projectId: '22222',
      projectKey: 'TGT',
      createStageAcknowledgement: {
        required: true,
        completed: true,
      },
    },
  );

  assert.ok(note.includes('High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement'));
  assert.ok(note.includes('Create-stage acknowledgement: checked in Personal AI preview only to create this disabled copy; Jira-side Activation plan review remains open before enablement.'));
});

test('buildJiraAutomationImportReviewNote records explicitly preserved rule chaining', () => {
  const note = buildJiraAutomationImportReviewNote(baseRule, {
    projectId: '22222',
    projectKey: 'TGT',
    allowOtherRuleTrigger: true,
  });

  assert.ok(note.includes('Imported as a disabled copy into TGT (22222).'));
  assert.ok(note.includes('Rule chaining: preserved from source by user choice.'));
});

test('buildJiraAutomationImportedRuleName truncates long names to Jira-safe length', () => {
  const importedName = buildJiraAutomationImportedRuleName('A'.repeat(400));

  assert.equal(importedName.length, JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH);
  assert.ok(importedName.startsWith('(Imported by Personal AI) '));
  assert.ok(importedName.endsWith('...'));
});

test('buildJiraAutomationUniqueImportedRuleName numbers duplicate imported rule names', () => {
  const importedName = buildJiraAutomationUniqueImportedRuleName('Notify release owner', [
    '(Imported by Personal AI) Notify release owner',
    '(Imported by Personal AI) Notify release owner (2)',
  ]);

  assert.equal(importedName, '(Imported by Personal AI) Notify release owner (3)');
});

test('buildJiraAutomationUniqueImportedRuleName keeps numbered duplicates within Jira-safe length', () => {
  const importedName = buildJiraAutomationUniqueImportedRuleName('A'.repeat(400), [
    buildJiraAutomationImportedRuleName('A'.repeat(400)),
  ]);

  assert.equal(importedName.length, JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH);
  assert.ok(importedName.endsWith('... (2)'));
});

test('buildJiraAutomationImportRule creates current project scope when source has none', () => {
  const importRule = buildJiraAutomationImportRule(
    {
      ...baseRule,
      projects: [],
    },
    {
      projectId: '33333',
      projectTypeKey: 'software',
      now: 1777600000100,
    },
  );

  assert.deepEqual(importRule.projects, [{ projectId: '33333', projectTypeKey: 'software' }]);
  assert.equal(importRule.authorAccountId, 'source-owner');
  assert.equal(importRule.actorAccountId, 'source-owner');
});

test('buildJiraAutomationImportRule collapses multiple source projects to one target project', () => {
  const importRule = buildJiraAutomationImportRule(
    {
      ...baseRule,
      projects: [
        { projectId: '11111', projectTypeKey: 'business' },
        { projectId: '22222', projectTypeKey: 'business' },
      ],
    },
    {
      projectId: '33333',
      projectTypeKey: 'software',
      now: 1777600000200,
    },
  );

  assert.deepEqual(importRule.projects, [{ projectId: '33333', projectTypeKey: 'software' }]);
});

test('buildJiraAutomationImportRule remaps nested component ids without touching value ids', () => {
  const importRule = buildJiraAutomationImportRule(
    {
      ...baseRule,
      components: [
        {
          id: 'source-component-1',
          component: 'CONDITION_BLOCK',
          type: 'jira.condition.container.block',
          value: {
            id: 'value-id-should-stay',
          },
          children: [
            {
              id: 'source-child-1',
              component: 'ACTION',
              type: 'jira.issue.outgoing.webhook',
            },
          ],
          conditions: [
            {
              id: 'source-condition-1',
              component: 'CONDITION',
              type: 'jira.comparator.condition',
            },
          ],
        },
      ],
    },
    {
      projectId: '33333',
      projectTypeKey: 'software',
      now: 1777600000300,
    },
  );

  assert.equal(importRule.components[0].id, '__NEW__COMPONENT__1777600000300');
  assert.equal(importRule.components[0].children[0].id, '__NEW__COMPONENT__1777600000301');
  assert.equal(importRule.components[0].conditions[0].id, '__NEW__COMPONENT__1777600000302');
  assert.equal(importRule.components[0].value.id, 'value-id-should-stay');
});

test('summarizeJiraAutomationImportRule detects nested actions, web requests, secrets, and schedules', () => {
  const summary = summarizeJiraAutomationImportRule({
    ...baseRule,
    trigger: {
      ...baseRule.trigger,
      value: {
        schedule: { method: 'CRON' },
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          usedSecretsKeys: ['personal-ai-token'],
        },
        children: [],
        conditions: [],
      },
      {
        component: 'CONDITION',
        type: 'jira.condition.container.block',
        children: [
          {
            component: 'ACTION',
            type: 'jira.issue.outgoing.webhook',
            value: {
              headers: [
                {
                  id: 'auth-header',
                  name: 'Authorization',
                  value: { keyOrValue: 'Bearer hidden', secret: true },
                },
              ],
            },
            children: [],
            conditions: [],
          },
        ],
        conditions: [
          {
            component: 'CONDITION',
            type: 'jira.comparator.condition',
            value: {},
          },
        ],
      },
    ],
  });

  assert.equal(summary.componentCount, 4);
  assert.equal(summary.actionCount, 2);
  assert.equal(summary.conditionCount, 2);
  assert.equal(summary.webRequestCount, 2);
  assert.equal(summary.externalIntegrationCount, 2);
  assert.equal(summary.secretReferenceCount, 2);
  assert.equal(summary.jqlReferenceCount, 0);
  assert.equal(summary.hardcodedUrlCount, 0);
  assert.equal(summary.emailReferenceCount, 0);
  assert.equal(summary.sourceProjectReferenceCount, 0);
  assert.equal(summary.scheduledTrigger, true);
});

test('summarizeJiraAutomationImportRule detects environment-bound references for review', () => {
  const rule = {
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        jql: 'project = SRC AND status = Done AND customfield_12345 is not EMPTY AND filter = 98765',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release',
          payload: '{"projectId":"11111","field":"customfield_54321","owner":"{{issue.assignee.accountId}}"}',
          recipients: 'release-owner@example.com',
          actorAccountId: 'abc-123-account',
          connectionId: 'prod-webhook-connection',
          savedFilterId: 13579,
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);

  assert.equal(summary.jqlReferenceCount, 1);
  assert.equal(summary.hardcodedUrlCount, 1);
  assert.equal(summary.emailReferenceCount, 1);
  assert.equal(summary.accountReferenceCount, 1);
  assert.equal(summary.customFieldReferenceCount, 2);
  assert.equal(summary.savedFilterReferenceCount, 2);
  assert.equal(summary.connectionReferenceCount, 1);
  assert.equal(summary.sourceProjectReferenceCount, 3);
  assert.equal(summary.smartValueReferenceCount, 1);
  assert.equal(summary.customComponentCount, 0);
  assert.deepEqual(reviewSignals.jqlReferences, ['project = SRC AND status = Done AND customfield_12345 is not EMPTY AND filter = 98765']);
  assert.deepEqual(reviewSignals.hardcodedUrls, ['https://hooks.example.com/SRC/release']);
  assert.deepEqual(reviewSignals.emailReferences, ['release-owner@example.com']);
  assert.deepEqual(reviewSignals.accountReferences, ['actorAccountId: abc-123-account']);
  assert.deepEqual(reviewSignals.customFieldReferences, ['customfield_12345', 'customfield_54321']);
  assert.deepEqual(reviewSignals.savedFilterReferences, ['filter = 98765', 'savedFilterId: 13579']);
  assert.deepEqual(reviewSignals.connectionReferences, ['connectionId: prod-webhook-connection']);
  assert.deepEqual(reviewSignals.smartValueReferences, ['{{issue.assignee.accountId}}']);
  assert.deepEqual(reviewSignals.customComponentReferences, []);
  assert.ok(reviewSignals.sourceProjectReferences.some((reference) => reference.includes('project = SRC')));
  assert.ok(reviewSignals.sourceProjectReferences.some((reference) => reference.includes('projectId')));
});

test('summarizeJiraAutomationImportRule flags app-provided components for compatibility review', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'vendor.release.deployment.action',
        value: {
          deploymentTemplateId: 'release-gate',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const findings = buildJiraAutomationImportReviewFindings(rule);
  const checklist = buildJiraAutomationImportReviewChecklist(rule);
  const enablementPlan = buildJiraAutomationImportEnablementPlan(rule);
  const warnings = buildJiraAutomationImportWarnings(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.equal(summary.customComponentCount, 1);
  assert.deepEqual(reviewSignals.customComponentReferences, ['ACTION: vendor.release.deployment.action']);
  assert.equal(findings.find((finding) => finding.id === 'custom-components')?.severity, 'high');
  assert.ok(checklist.some((item) => item.id === 'custom-components' && item.severity === 'high'));
  assert.ok(enablementPlan.some((step) => step.id === 'confirm-app-components' && step.severity === 'high'));
  assert.ok(warnings.some((warning) => warning.includes('custom or app-provided component')));
  assert.ok(note.includes('custom/app component'));
  assert.ok(note.includes('Custom / app components (1): ACTION: vendor.release.deployment.action'));
  assert.ok(packet.includes('[HIGH] Custom / app components'));
  assert.ok(packet.includes('[HIGH] Confirm app-provided components are available'));
});

test('collectJiraAutomationImportReviewSignals redacts sensitive and masked values', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          authorizationHeader: '*****',
          apiToken: 'prod-api-token-123',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const findings = buildJiraAutomationImportReviewFindings(rule);
  const warnings = buildJiraAutomationImportWarnings(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.equal(summary.sensitiveReferenceCount, 2);
  assert.deepEqual(reviewSignals.sensitiveReferences, [
    'authorizationHeader: hidden/masked value',
    'apiToken: sensitive value present',
  ]);
  assert.equal(findings.find((finding) => finding.id === 'sensitive-values')?.severity, 'high');
  assert.ok(warnings.some((warning) => warning.includes('Re-enter masked web request headers')));
  assert.ok(note.includes('Sensitive / hidden values (2): authorizationHeader: hidden/masked value | apiToken: sensitive value present'));
  assert.ok(!note.includes('prod-api-token-123'));
});

test('collectJiraAutomationImportReviewSignals does not expose secret keyOrValue payloads', () => {
  const rule = {
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          headers: [
            {
              name: 'Authorization',
              value: {
                keyOrValue: 'https://hooks.example.com/SRC/hiddenSecretPath1234567890ABCD?token=prod-token-should-not-leak&owner=secret-owner@example.com {{issue.assignee.accountId}} project = SRC',
                secret: true,
              },
            },
          ],
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.equal(summary.secretReferenceCount, 1);
  assert.equal(summary.hardcodedUrlCount, 0);
  assert.equal(summary.sourceProjectReferenceCount, 0);
  assert.equal(summary.smartValueReferenceCount, 0);
  assert.deepEqual(reviewSignals.secretReferences, ['Authorization: hidden secret value']);
  assert.deepEqual(reviewSignals.hardcodedUrls, []);
  assert.deepEqual(reviewSignals.sourceProjectReferences, []);
  assert.deepEqual(reviewSignals.smartValueReferences, []);
  assert.ok(note.includes('Secrets (1): Authorization: hidden secret value'));
  assert.ok(!note.includes('prod-token-should-not-leak'));
  assert.ok(!note.includes('hiddenSecretPath1234567890ABCD'));
  assert.ok(!note.includes('secret-owner@example.com'));
  assert.ok(!note.includes('{{issue.assignee.accountId}}'));
});

test('collectJiraAutomationImportReviewSignals gives hidden secrets safe re-entry labels', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          headers: [
            {
              name: 'Authorization',
              value: {
                secret: true,
                keyOrValue: 'Bearer sk-prod-secret-should-not-leak',
              },
            },
          ],
          secretSlot: {
            secret: true,
            name: 'https://hooks.slack.com/services/T00000000/B00000000/xoxb123456789ABCDEFGHIJKLMNOP',
            keyOrValue: 'xoxb123456789ABCDEFGHIJKLMNOP',
          },
        },
      },
    ],
  };

  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const checklist = buildJiraAutomationImportReviewChecklist(rule);
  const enablementPlan = buildJiraAutomationImportEnablementPlan(rule);
  const warnings = buildJiraAutomationImportWarnings(rule);
  const secretReentrySlots = collectJiraAutomationImportSecretReentrySlots(rule);
  const secretReentrySummary = formatJiraAutomationImportSecretReentrySummary(secretReentrySlots);
  const credentialQueue = formatJiraAutomationImportSecretReentryQueue(secretReentrySlots);
  const credentialQueueGroups = buildJiraAutomationImportSecretReentryQueueGroups(secretReentrySlots);
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.deepEqual(reviewSignals.secretReferences, [
    'Authorization: hidden secret value',
    'secretSlot: hidden secret value',
  ]);
  assert.ok(checklist.some((item) => item.detail.includes('Authorization: hidden secret value')));
  assert.ok(enablementPlan.some((step) => step.detail.includes('Secret re-entry map')));
  assert.ok(enablementPlan.some((step) => step.detail.includes('components[0].value.secretSlot')));
  assert.ok(warnings.some((warning) => warning.includes('Jira export/import will not restore hidden values')));
  assert.ok(warnings.some((warning) => warning.includes('Secret re-entry map')));
  assert.ok(secretReentrySummary.includes('components[0].value.headers[0].value (Authorization: hidden secret value)'));
  assert.ok(secretReentrySummary.includes('components[0].value.secretSlot (secretSlot: hidden secret value)'));
  assert.deepEqual(credentialQueueGroups.map((group) => group.id), ['hidden-jira-secrets']);
  assert.ok(credentialQueue.includes('Credential re-entry queue: 1 group(s) from 2 redacted slot(s).'));
  assert.ok(credentialQueue.includes('Hidden Jira secrets (2): components[0].value.headers[0].value'));
  assert.ok(credentialQueue.includes('Re-enter or recreate the masked Jira secret fields in the imported rule.'));
  assert.ok(buildJiraAutomationImportCredentialRestoreGateSummary(secretReentrySlots).includes('Credential restore gate: open before enablement'));
  assert.ok(buildJiraAutomationImportCredentialRestoreGateSummary(secretReentrySlots).includes('PERSONAL_AI_REENTER_SECRET or REDACTED placeholders'));
  assert.ok(packet.includes('Authorization: hidden secret value'));
  assert.ok(packet.includes('Credential restore gate: open before enablement'));
  assert.ok(packet.includes('Credential re-entry queue: 1 group(s) from 2 redacted slot(s).'));
  assert.ok(packet.includes('## Secret re-entry map'));
  assert.ok(packet.includes('components[0].value.headers[0].value (Authorization: hidden secret value)'));
  assert.ok(packet.includes('components[0].value.secretSlot (secretSlot: hidden secret value)'));
  assert.ok(!packet.includes('sk-prod-secret-should-not-leak'));
  assert.ok(!packet.includes('xoxb123456789ABCDEFGHIJKLMNOP'));
  assert.ok(!packet.includes('hooks.slack.com/services'));
  assert.ok(!secretReentrySummary.includes('sk-prod-secret-should-not-leak'));
  assert.ok(!secretReentrySummary.includes('xoxb123456789ABCDEFGHIJKLMNOP'));
  assert.ok(!secretReentrySummary.includes('hooks.slack.com/services'));
});

test('buildJiraAutomationImportRule scrubs hidden and sensitive payloads before create request', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        id: 'source-component-1',
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release/releaseSecretPath1234567890ABCD?apiToken=prod-api-token-123&project=SRC',
          authorizationHeader: 'Bearer sk-prod-secret-should-not-leak',
          apiToken: 'prod-api-token-123',
          headers: [
            {
              name: 'Authorization',
              value: {
                secret: true,
                keyOrValue: 'Bearer sk-prod-secret-should-not-leak',
              },
            },
          ],
          secretSlot: {
            secret: true,
            name: 'https://hooks.slack.com/services/T00000000/B00000000/xoxb123456789ABCDEFGHIJKLMNOP',
            keyOrValue: 'xoxb123456789ABCDEFGHIJKLMNOP',
          },
        },
      },
    ],
  };

  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    now: 1777600000700,
  });
  const payloadText = JSON.stringify(importRule);

  assert.equal(importRule.components[0].id, '__NEW__COMPONENT__1777600000700');
  assert.equal(
    importRule.components[0].value.url,
    'https://hooks.example.com/SRC/release/REDACTED?apiToken=REDACTED&project=SRC',
  );
  assert.equal(
    importRule.components[0].value.authorizationHeader,
    JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  );
  assert.equal(
    importRule.components[0].value.apiToken,
    JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  );
  assert.equal(
    importRule.components[0].value.headers[0].value.keyOrValue,
    JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  );
  assert.equal(
    importRule.components[0].value.secretSlot.name,
    JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  );
  assert.equal(
    importRule.components[0].value.secretSlot.keyOrValue,
    JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER,
  );
  assert.match(payloadText, new RegExp(JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER));
  assert.doesNotMatch(payloadText, /sk-prod-secret-should-not-leak/);
  assert.doesNotMatch(payloadText, /prod-api-token-123/);
  assert.doesNotMatch(payloadText, /releaseSecretPath1234567890ABCD/);
  assert.doesNotMatch(payloadText, /xoxb123456789ABCDEFGHIJKLMNOP/);
  assert.doesNotMatch(payloadText, /hooks\.slack\.com\/services/);
  assert.equal(
    rule.components[0].value.headers[0].value.keyOrValue,
    'Bearer sk-prod-secret-should-not-leak',
  );
});

test('free-text import fields redact inline secrets across display, notes, labels, and payload', () => {
  const rule = {
    ...baseRule,
    name: 'Deploy token=prod-name-token-123',
    description: [
      'Source handoff keeps business context.',
      'clientSecret="desc-client-secret-456"',
      'Authorization: Bearer desc-bearer-secret-789',
      'Webhook https://hooks.example.com/SRC/description/descSecretPath1234567890ABCD?apiToken=desc-api-token-123',
    ].join('\n'),
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    labels: ['release', 'token=label-secret-token-123'],
    components: [
      {
        id: 'source-component-1',
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          customBody: JSON.stringify({
            clientId: 'visible-client-id',
            clientSecret: 'body-client-secret-123',
            nested: {
              jwt: 'body-jwt-secret-456',
            },
          }),
          body: 'Authorization: Bearer body-bearer-secret-789 token=body-token-secret-123',
          safeMessage: 'Release note for project SRC',
        },
      },
    ],
  };

  const displayName = sanitizeJiraAutomationImportDisplayText(rule.name);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    now: 1777600000900,
  });
  const payloadText = JSON.stringify(importRule);

  assert.equal(displayName, 'Deploy token=REDACTED');
  assert.equal(importRule.name, '(Imported by Personal AI) Deploy token=REDACTED');
  assert.deepEqual(importRule.labels, ['release', `token=${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}`]);
  assert.match(importRule.description || '', /clientSecret="REDACTED"/);
  assert.match(importRule.description || '', /Authorization: Bearer REDACTED/);
  assert.match(importRule.description || '', /description\/REDACTED\?apiToken=REDACTED/);
  assert.match(importRule.components[0].value.customBody, new RegExp(`"clientSecret":"${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}"`));
  assert.match(importRule.components[0].value.customBody, new RegExp(`"jwt":"${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}"`));
  assert.match(importRule.components[0].value.body, new RegExp(`Authorization: Bearer ${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}`));
  assert.match(importRule.components[0].value.body, new RegExp(`token=${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}`));
  assert.ok(packet.includes('- Source rule: Deploy token=REDACTED'));
  assert.ok(reviewSignals.sourceProjectReferences.some((reference) => reference.includes('clientSecret="REDACTED"')));
  assert.doesNotMatch(packet, /prod-name-token-123|desc-client-secret-456|desc-bearer-secret-789|descSecretPath1234567890ABCD|desc-api-token-123/);
  assert.doesNotMatch(payloadText, /prod-name-token-123|label-secret-token-123|body-client-secret-123|body-jwt-secret-456|body-bearer-secret-789|body-token-secret-123/);
  assert.doesNotMatch(payloadText, /desc-client-secret-456|desc-bearer-secret-789|descSecretPath1234567890ABCD|desc-api-token-123/);
});

test('provider API keys and JWT-style credentials are redacted across preview artifacts and payload', () => {
  const googleApiKey = 'AIzaSyDexampleProviderKey1234567890ABCD';
  const jwtValue = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.c2lnbmF0dXJlLXZhbHVlMTIz456';
  const clientAssertion = 'client.assertion.secret.abcdefghijklmnopqrstuvwxyz1234567890';
  const openAiKey = 'sk-proj-exampleProviderSecret1234567890abcdef';
  const anthropicKey = 'sk-ant-api03-exampleProviderSecret1234567890abcdef';
  const rule = {
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    components: [
      {
        id: 'source-component-1',
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: `https://api.example.com/run?key=${googleApiKey}&id_token=${jwtValue}&project=SRC`,
          clientAssertion,
          customBody: JSON.stringify({
            openaiApiKey: openAiKey,
            anthropicKey,
            jwt: jwtValue,
            project: 'SRC',
          }),
          headers: [
            {
              name: 'X-API-Key',
              value: googleApiKey,
            },
          ],
        },
      },
    ],
  };

  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const secretReentrySlots = collectJiraAutomationImportSecretReentrySlots(rule);
  const secretReentrySummary = formatJiraAutomationImportSecretReentrySummary(secretReentrySlots);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    now: 1777600000950,
  });
  const payloadText = JSON.stringify(importRule);

  assert.deepEqual(reviewSignals.hardcodedUrls, [
    'https://api.example.com/run?key=REDACTED&id_token=REDACTED&project=SRC',
  ]);
  assert.ok(reviewSignals.sensitiveReferences.includes('URL query key: sensitive value present'));
  assert.ok(reviewSignals.sensitiveReferences.includes('URL query id_token: sensitive value present'));
  assert.ok(secretReentrySummary.includes('components[0].value.url (url)'));
  assert.ok(secretReentrySummary.includes('components[0].value.clientAssertion (clientAssertion)'));
  assert.ok(secretReentrySummary.includes('components[0].value.customBody (customBody)'));
  assert.ok(secretReentrySummary.includes('components[0].value.headers[0].value (X-API-Key)'));
  assert.equal(
    importRule.components[0].value.url,
    'https://api.example.com/run?key=REDACTED&id_token=REDACTED&project=SRC',
  );
  assert.equal(importRule.components[0].value.clientAssertion, JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER);
  assert.equal(importRule.components[0].value.headers[0].value, JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER);
  assert.match(importRule.components[0].value.customBody, new RegExp(`"openaiApiKey":"${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}"`));
  assert.match(importRule.components[0].value.customBody, new RegExp(`"anthropicKey":"${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}"`));
  assert.match(importRule.components[0].value.customBody, new RegExp(`"jwt":"${JIRA_AUTOMATION_IMPORT_SECRET_PLACEHOLDER}"`));
  assert.doesNotMatch(note, new RegExp(`${googleApiKey}|${jwtValue}|${clientAssertion}|${openAiKey}|${anthropicKey}`));
  assert.doesNotMatch(packet, new RegExp(`${googleApiKey}|${jwtValue}|${clientAssertion}|${openAiKey}|${anthropicKey}`));
  assert.doesNotMatch(payloadText, new RegExp(`${googleApiKey}|${jwtValue}|${clientAssertion}|${openAiKey}|${anthropicKey}`));
});

test('buildJiraAutomationImportReviewPacket creates a sanitized enablement handoff', () => {
  const packet = buildJiraAutomationImportReviewPacket(
    {
      ...baseRule,
      projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
      trigger: {
        ...baseRule.trigger,
        value: {
          schedule: { method: 'CRON' },
          jql: 'project = SRC AND customfield_12345 is not EMPTY',
        },
      },
      components: [
        {
          component: 'ACTION',
          type: 'jira.issue.outgoing.webhook',
          value: {
            url: 'https://hooks.example.com/SRC/release/releaseSecretPath1234567890ABCD?apiToken=prod-api-token-123',
            usedSecretsKeys: ['release-webhook-token'],
            connectionId: 'prod-webhook-connection',
            headers: [
              {
                name: 'Authorization',
                value: {
                  secret: true,
                  keyOrValue: 'hidden-secret-token',
                },
              },
            ],
          },
        },
      ],
    },
    {
      projectId: '22222',
      projectKey: 'TGT',
      projectTypeKey: 'software',
      existingRuleNames: ['(Imported by Personal AI) Notify release owner'],
      allowOtherRuleTrigger: false,
    },
  );

  assert.ok(packet.includes('# Jira Automation import review'));
  assert.ok(packet.includes('- Imported name: (Imported by Personal AI) Notify release owner (2)'));
  assert.ok(packet.includes('- Target project: TGT (22222)'));
  assert.ok(packet.includes('- Imported state: DISABLED'));
  assert.ok(packet.includes('- Rule chaining: blocked in imported copy'));
  assert.ok(packet.includes('- High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement'));
  assert.ok(packet.includes('- Credential restore gate: open before enablement'));
  assert.ok(packet.includes('## Review before enabling'));
  assert.ok(packet.includes('[HIGH] JQL and filters'));
  assert.ok(packet.includes('[HIGH] External effects and credentials'));
  assert.ok(packet.includes('## Detected environment bindings'));
  assert.ok(packet.includes('[HIGH] Secrets (2): release-webhook-token | Authorization: hidden secret value'));
  assert.ok(packet.includes('/SRC/release/REDACTED?apiToken=REDACTED'));
  assert.ok(packet.includes('## Secret re-entry map'));
  assert.ok(packet.includes('- Credential re-entry queue: 3 group(s) from 3 redacted slot(s).'));
  assert.ok(packet.includes('Hidden Jira secrets (1): components[0].value.headers[0].value'));
  assert.ok(packet.includes('URL and signed-query credentials (1): components[0].value.url (url)'));
  assert.ok(packet.includes('Inline secret-like text (1): components[0].value.usedSecretsKeys[0] (usedSecretsKeys)'));
  assert.ok(packet.includes('components[0].value.url (url): URL credential, sensitive query, fragment, or token-like path was redacted'));
  assert.ok(packet.includes('components[0].value.headers[0].value (Authorization: hidden secret value)'));
  assert.ok(packet.includes('## Activation plan'));
  assert.ok(packet.includes('[HIGH] Map target-project search dependencies'));
  assert.ok(packet.includes('[HIGH] Reconnect external effects and credentials'));
  assert.ok(packet.includes('[MEDIUM] Test dynamic trigger behavior'));
  assert.ok(packet.includes('## Import warnings'));
  assert.ok(!packet.includes('prod-api-token-123'));
  assert.ok(!packet.includes('releaseSecretPath1234567890ABCD'));
  assert.ok(!packet.includes('hidden-secret-token'));
});

test('name collision check receipt records confirmed and unconfirmed target-rule lookup state', () => {
  const confirmedReceipt = buildJiraAutomationImportNameCheckReceipt(
    baseRule,
    {
      projectId: '22222',
      projectKey: 'TGT',
      existingRuleNames: ['(Imported by Personal AI) Notify release owner'],
      nameCheck: {
        status: 'confirmed',
        checkedRuleCount: 1,
      },
    },
  );

  assert.match(confirmedReceipt, /confirmed against 1 target rule/);
  assert.match(confirmedReceipt, /Personal AI selected "\(Imported by Personal AI\) Notify release owner \(2\)"/);

  const packet = buildJiraAutomationImportReviewPacket(baseRule, {
    projectId: '22222',
    projectKey: 'TGT',
    nameCheck: {
      status: 'unconfirmed',
      failureReason: 'GET failed for https://jira.example.test/rule?token=secret-token-123&owner=secret-owner@example.com',
    },
  });
  const note = buildJiraAutomationImportReviewNote(baseRule, {
    projectId: '22222',
    projectKey: 'TGT',
    nameCheck: {
      status: 'unconfirmed',
      failureReason: 'Authorization: Bearer sk-prod-secret-should-not-leak; owner=secret-owner@example.com',
    },
  });

  assert.match(packet, /Name collision check: not confirmed/);
  assert.match(packet, /best-effort disabled-copy name/);
  assert.match(packet, /token=REDACTED/);
  assert.doesNotMatch(packet, /secret-token-123/);
  assert.doesNotMatch(packet, /secret-owner@example.com/);
  assert.match(note, /Name collision check: not confirmed/);
  assert.match(note, /Authorization: Bearer REDACTED/);
  assert.match(note, /REDACTED_EMAIL/);
  assert.doesNotMatch(note, /sk-prod-secret-should-not-leak/);
  assert.doesNotMatch(note, /secret-owner@example.com/);
});

test('source cloud=false adds source-format compatibility handoff', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release?apiToken=prod-api-token-123',
          connectionId: 'prod-webhook-connection',
        },
      },
      {
        component: 'ACTION',
        type: 'vendor.release.deployment.action',
        value: {
          deploymentTemplateId: 'release-gate',
        },
      },
    ],
  };

  const checklist = buildJiraAutomationImportReviewChecklist(rule, false);
  const steps = buildJiraAutomationImportEnablementPlan(rule, false);
  const warnings = buildJiraAutomationImportWarnings(rule, false);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    sourceCloud: false,
  });
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    sourceCloud: false,
  });
  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    sourceCloud: false,
    now: 1777600000800,
  });

  assert.equal(formatJiraAutomationImportSourceFormat(false), 'Jira Server/Data Center export (cloud=false)');
  assert.ok(checklist.some((item) => item.id === 'source-format' && item.severity === 'high'));
  assert.equal(steps[1].id, 'confirm-source-format');
  assert.equal(steps[1].severity, 'high');
  assert.match(steps[1].detail, /source file is marked cloud=false/i);
  assert.match(steps[1].detail, /web request/);
  assert.ok(warnings.some((warning) => warning.includes('Source export is marked cloud=false')));
  assert.ok(note.includes('Source format: Jira Server/Data Center export (cloud=false).'));
  assert.ok(note.includes('High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement'));
  assert.ok(packet.includes('- Source format: Jira Server/Data Center export (cloud=false)'));
  assert.ok(packet.includes('- High-risk gate: no checkbox required before disabled-copy creation; Jira-side review remains open before enablement'));
  assert.ok(packet.includes('[HIGH] Source format compatibility'));
  assert.ok(packet.includes('[HIGH] Confirm source-format compatibility'));
  assert.ok(importRule.description?.includes('Source format: Jira Server/Data Center export (cloud=false).'));
});

test('buildJiraAutomationImportEnablementPlan prioritizes post-import activation steps', () => {
  const steps = buildJiraAutomationImportEnablementPlan({
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        schedule: { method: 'CRON' },
        jql: 'project = SRC AND customfield_12345 is not EMPTY AND filter = 98765',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release?apiToken=prod-api-token-123',
          usedSecretsKeys: ['release-webhook-token'],
          recipients: 'release-owner@example.com',
          connectionId: 'prod-webhook-connection',
          body: '{{issue.assignee.accountId}}',
        },
      },
    ],
  });

  assert.deepEqual(
    steps.map((step) => step.id),
    [
      'keep-disabled',
      'map-target-search',
      'reconnect-external-effects',
      'test-dynamic-behavior',
      'confirm-actor-and-audit',
    ],
  );
  assert.equal(steps.find((step) => step.id === 'map-target-search')?.severity, 'high');
  assert.equal(steps.find((step) => step.id === 'reconnect-external-effects')?.severity, 'high');
  assert.equal(steps.find((step) => step.id === 'test-dynamic-behavior')?.severity, 'medium');
  assert.match(
    steps.find((step) => step.id === 'map-target-search')?.detail || '',
    /JQL\/filter reference/,
  );
  assert.match(
    steps.find((step) => step.id === 'reconnect-external-effects')?.detail || '',
    /connection\/credential reference/,
  );
});

test('collectJiraAutomationImportReviewSignals redacts sensitive URL credentials and parameters', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://user:pass@hooks.example.com/SRC/release?apiToken=prod-api-token-123&project=SRC&debug=true#access_token=secret-fragment',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.equal(summary.hardcodedUrlCount, 1);
  assert.equal(summary.sensitiveReferenceCount, 3);
  assert.deepEqual(reviewSignals.hardcodedUrls, [
    'https://REDACTED:REDACTED@hooks.example.com/SRC/release?apiToken=REDACTED&project=SRC&debug=true#REDACTED',
  ]);
  assert.deepEqual(reviewSignals.sensitiveReferences, [
    'URL credentials: sensitive value present',
    'URL query apiToken: sensitive value present',
    'URL fragment: sensitive value present',
  ]);
  assert.ok(note.includes('Hard-coded URLs (1): https://REDACTED:REDACTED@hooks.example.com/SRC/release?apiToken=REDACTED'));
  assert.ok(note.includes('Sensitive / hidden values (3): URL credentials: sensitive value present | URL query apiToken: sensitive value present'));
  assert.ok(!note.includes('prod-api-token-123'));
  assert.ok(!note.includes('secret-fragment'));
});

test('signed URL credential query parameters are redacted across handoff artifacts', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://bucket.s3.amazonaws.com/release.json?X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260623%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Security-Token=aws-session-token-123456789&X-Amz-Signature=aws-signature-secret-1234567890&project=SRC',
          azureWebhookUrl: 'https://storage.blob.core.windows.net/container/release.json?sv=2025-01-05&sp=r&sig=azure-sas-signature-secret-1234567890&sr=b',
          googleSignedUrl: 'https://storage.googleapis.com/bucket/release.json?GoogleAccessId=service-account@example.iam.gserviceaccount.com&Signature=gcs-signature-secret-1234567890&Expires=1777600000',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const slots = collectJiraAutomationImportSecretReentrySlots(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    sourceCloud: true,
  });
  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    projectTypeKey: 'software',
    now: 1777600000700,
  });
  const artifactText = [
    JSON.stringify(reviewSignals),
    JSON.stringify(slots),
    note,
    packet,
    JSON.stringify(importRule),
  ].join('\n');

  assert.equal(summary.hardcodedUrlCount, 3);
  assert.equal(summary.sensitiveReferenceCount, 6);
  assert.deepEqual(reviewSignals.sensitiveReferences, [
    'URL query X-Amz-Credential: sensitive value present',
    'URL query X-Amz-Security-Token: sensitive value present',
    'URL query X-Amz-Signature: sensitive value present',
    'URL query sig: sensitive value present',
    'URL query GoogleAccessId: sensitive value present',
    'URL query Signature: sensitive value present',
  ]);
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('X-Amz-Credential=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('sig=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('GoogleAccessId=REDACTED')));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.url'));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.azureWebhookUrl'));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.googleSignedUrl'));
  assert.match(JSON.stringify(importRule.components), /X-Amz-Signature=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /X-Amz-Security-Token=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /sig=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /GoogleAccessId=REDACTED/);
  assert.doesNotMatch(artifactText, /AKIAIOSFODNN7EXAMPLE/);
  assert.doesNotMatch(artifactText, /aws-session-token-123456789/);
  assert.doesNotMatch(artifactText, /aws-signature-secret-1234567890/);
  assert.doesNotMatch(artifactText, /azure-sas-signature-secret-1234567890/);
  assert.doesNotMatch(artifactText, /service-account@example\.iam\.gserviceaccount\.com/);
  assert.doesNotMatch(artifactText, /gcs-signature-secret-1234567890/);
});

test('function and API gateway URL query credentials are redacted across handoff artifacts', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://release-fn.azurewebsites.net/api/notify?code=azure-function-code-secret-1234567890&project=SRC',
          gatewayUrl: 'https://gateway.example.test/release?subscription-key=apim-subscription-secret-1234567890&Ocp-Apim-Subscription-Key=ocp-apim-secret-1234567890&ticket=SRC-123',
          sasCallbackUrl: 'https://storage.example.test/release?sasToken=sas-token-secret-1234567890&sharedAccessKey=shared-access-secret-1234567890',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const slots = collectJiraAutomationImportSecretReentrySlots(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const packet = buildJiraAutomationImportReviewPacket(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });
  const importRule = buildJiraAutomationImportRule(rule, {
    projectId: '22222',
    projectKey: 'TGT',
    projectTypeKey: 'software',
    now: 1777600000710,
  });
  const artifactText = [
    JSON.stringify(reviewSignals),
    JSON.stringify(slots),
    note,
    packet,
    JSON.stringify(importRule),
  ].join('\n');

  assert.equal(summary.hardcodedUrlCount, 3);
  assert.equal(summary.sensitiveReferenceCount, 5);
  assert.deepEqual(reviewSignals.sensitiveReferences, [
    'URL query code: sensitive value present',
    'URL query subscription-key: sensitive value present',
    'URL query Ocp-Apim-Subscription-Key: sensitive value present',
    'URL query sasToken: sensitive value present',
    'URL query sharedAccessKey: sensitive value present',
  ]);
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('code=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('subscription-key=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('Ocp-Apim-Subscription-Key=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('sasToken=REDACTED')));
  assert.ok(reviewSignals.hardcodedUrls.some((url) => url.includes('sharedAccessKey=REDACTED')));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.url'));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.gatewayUrl'));
  assert.ok(slots.some((slot) => slot.path === 'components[0].value.sasCallbackUrl'));
  assert.match(JSON.stringify(importRule.components), /code=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /subscription-key=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /Ocp-Apim-Subscription-Key=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /sasToken=REDACTED/);
  assert.match(JSON.stringify(importRule.components), /sharedAccessKey=REDACTED/);
  assert.match(packet, /URL query code: sensitive value present/);
  assert.match(note, /Sensitive \/ hidden values \(5\): URL query code: sensitive value present/);
  assert.doesNotMatch(artifactText, /azure-function-code-secret-1234567890/);
  assert.doesNotMatch(artifactText, /apim-subscription-secret-1234567890/);
  assert.doesNotMatch(artifactText, /ocp-apim-secret-1234567890/);
  assert.doesNotMatch(artifactText, /sas-token-secret-1234567890/);
  assert.doesNotMatch(artifactText, /shared-access-secret-1234567890/);
});

test('collectJiraAutomationImportReviewSignals redacts sensitive webhook URL path tokens', () => {
  const rule = {
    ...baseRule,
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.slack.com/services/T00000000/B00000000/xoxb123456789ABCDEFGHIJKLMNOP',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);
  const note = buildJiraAutomationImportReviewNote(rule, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.equal(summary.hardcodedUrlCount, 1);
  assert.equal(summary.sensitiveReferenceCount, 1);
  assert.deepEqual(reviewSignals.hardcodedUrls, [
    'https://hooks.slack.com/services/REDACTED/REDACTED/REDACTED',
  ]);
  assert.deepEqual(reviewSignals.sensitiveReferences, [
    'URL path segment: sensitive value present',
  ]);
  assert.ok(note.includes('Hard-coded URLs (1): https://hooks.slack.com/services/REDACTED/REDACTED/REDACTED'));
  assert.ok(note.includes('Sensitive / hidden values (1): URL path segment: sensitive value present'));
  assert.ok(!note.includes('xoxb123456789ABCDEFGHIJKLMNOP'));
});

test('redactJiraAutomationImportErrorText removes secrets from failed API details', () => {
  const redacted = redactJiraAutomationImportErrorText([
    'API call failed: 400 Bad Request',
    '{"message":"Invalid webhook URL https://user:pass@hooks.example.com/SRC/hiddenSecretPath1234567890ABCD?apiToken=prod-api-token-123&owner=secret-owner@example.com#access_token=secret-fragment"}',
    'Authorization: Bearer sk-prod-secret-should-not-leak',
    'Contact secret-owner@example.com for details',
    '"keyOrValue":"hidden-secret-token"',
  ].join('\n'));

  assert.match(redacted, /API call failed: 400 Bad Request/);
  assert.match(redacted, /apiToken=REDACTED/);
  assert.match(redacted, /Authorization: Bearer REDACTED/);
  assert.match(redacted, /keyOrValue":"REDACTED/);
  assert.match(redacted, /REDACTED_EMAIL/);
  assert.doesNotMatch(redacted, /prod-api-token-123/);
  assert.doesNotMatch(redacted, /hiddenSecretPath1234567890ABCD/);
  assert.doesNotMatch(redacted, /secret-fragment/);
  assert.doesNotMatch(redacted, /sk-prod-secret-should-not-leak/);
  assert.doesNotMatch(redacted, /hidden-secret-token/);
  assert.doesNotMatch(redacted, /secret-owner@example.com/);
});

test('buildJiraAutomationImportReviewFindings groups environment-bound values for preview and review note', () => {
  const findings = buildJiraAutomationImportReviewFindings({
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        jql: 'project = SRC AND customfield_12345 is not EMPTY AND filter = 98765',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release',
          usedSecretsKeys: ['release-webhook-token'],
          recipients: 'release-owner@example.com',
          connectionId: 'prod-webhook-connection',
          savedFilterId: 13579,
          body: '{{issue.assignee.accountId}}',
        },
      },
    ],
  });

  assert.deepEqual(
    findings.map((finding) => finding.id),
    [
      'jql-filters',
      'source-project-references',
      'custom-fields',
      'saved-filters',
      'secrets',
      'connections',
      'smart-values',
      'hard-coded-urls',
      'accounts',
    ],
  );
  assert.equal(findings.find((finding) => finding.id === 'jql-filters')?.severity, 'high');
  assert.equal(findings.find((finding) => finding.id === 'hard-coded-urls')?.severity, 'medium');
  assert.deepEqual(findings.find((finding) => finding.id === 'secrets')?.samples, ['release-webhook-token']);
  assert.deepEqual(findings.find((finding) => finding.id === 'connections')?.samples, ['connectionId: prod-webhook-connection']);
  assert.deepEqual(findings.find((finding) => finding.id === 'smart-values')?.samples, ['{{issue.assignee.accountId}}']);

  const note = buildJiraAutomationImportReviewNote({
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        jql: 'project = SRC AND status = Done',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          connectionId: 'prod-webhook-connection',
        },
      },
    ],
  }, {
    projectId: '22222',
    projectKey: 'TGT',
  });

  assert.ok(note.includes('Top detected bindings: JQL / filters (1): project = SRC AND status = Done'));
  assert.ok(note.includes('Connections (1): connectionId: prod-webhook-connection'));
});

test('buildJiraAutomationImportWarnings calls out disabled import and project remap', () => {
  const warnings = buildJiraAutomationImportWarnings({
    ...baseRule,
    projects: [
      { projectId: '11111', projectTypeKey: 'software' },
      { projectId: '22222', projectTypeKey: 'software' },
    ],
  });

  assert.ok(warnings.some((warning) => warning.includes('disabled')));
  assert.ok(warnings.some((warning) => warning.includes('current Jira project')));
  assert.ok(warnings.some((warning) => warning.includes('Multiple source project scopes')));
  assert.ok(warnings.some((warning) => warning.includes('Scheduled trigger')));
  assert.ok(warnings.some((warning) => warning.includes('same Jira Automation version')));
  assert.ok(warnings.some((warning) => warning.includes('chained-trigger safeguard')));
});

test('buildJiraAutomationImportWarnings calls out environment-bound references', () => {
  const warnings = buildJiraAutomationImportWarnings({
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        jql: 'project = SRC AND fixVersion = latestReleasedVersion()',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release',
          recipients: 'release-owner@example.com',
          actorAccountId: 'abc-123-account',
          connectionId: 'prod-webhook-connection',
          fieldId: 'customfield_12345',
          body: '{{webhookData.targetUrl}}',
        },
      },
    ],
  });

  assert.ok(warnings.some((warning) => warning.includes('Project scope remapping does not rewrite')));
  assert.ok(warnings.some((warning) => warning.includes('JQL or filter')));
  assert.ok(warnings.some((warning) => warning.includes('hard-coded URL')));
  assert.ok(warnings.some((warning) => warning.includes('email or account')));
  assert.ok(warnings.some((warning) => warning.includes('Environment-bound references detected')));
  assert.ok(warnings.some((warning) => warning.includes('smart value reference')));
});

test('buildJiraAutomationImportReviewChecklist groups enablement review risks by severity', () => {
  const checklist = buildJiraAutomationImportReviewChecklist({
    ...baseRule,
    projects: [{ projectId: '11111', projectKey: 'SRC', projectTypeKey: 'software' }],
    trigger: {
      ...baseRule.trigger,
      value: {
        schedule: { method: 'CRON' },
        jql: 'project = SRC AND status = Done',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release',
          usedSecretsKeys: ['personal-ai-token'],
          recipients: 'release-owner@example.com',
          fieldId: 'customfield_12345',
          savedFilterId: 24680,
          body: '{{issue.assignee.accountId}}',
        },
      },
    ],
  });

  assert.deepEqual(
    checklist.map((item) => item.id),
    [
      'target-project',
      'jql-filters',
      'source-project-references',
      'external-effects',
      'environment-bindings',
      'smart-values',
      'schedule',
      'rule-chaining',
      'version-compatibility',
    ],
  );
  assert.equal(checklist.find((item) => item.id === 'target-project')?.severity, 'high');
  assert.equal(checklist.find((item) => item.id === 'external-effects')?.severity, 'high');
  assert.equal(checklist.find((item) => item.id === 'environment-bindings')?.severity, 'high');
  assert.equal(checklist.find((item) => item.id === 'smart-values')?.severity, 'medium');
  assert.equal(checklist.find((item) => item.id === 'schedule')?.severity, 'medium');
  assert.equal(checklist.find((item) => item.id === 'version-compatibility')?.severity, 'low');
});

test('isJiraAutomationImportFileSizeAllowed follows Atlassian 5MB limit', () => {
  assert.equal(isJiraAutomationImportFileSizeAllowed(JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES), true);
  assert.equal(isJiraAutomationImportFileSizeAllowed(JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES + 1), false);
});

test('buildJiraAutomationImportRule requires target project id', () => {
  assert.throws(() => buildJiraAutomationImportRule(baseRule, { projectId: '' }), {
    message: 'Target Jira projectId is required',
  });
});
