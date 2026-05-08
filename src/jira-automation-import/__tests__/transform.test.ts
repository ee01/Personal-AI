import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JIRA_AUTOMATION_IMPORT_MAX_FILE_BYTES,
  JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH,
  buildJiraAutomationImportedRuleName,
  buildJiraAutomationImportRule,
  buildJiraAutomationImportReviewChecklist,
  buildJiraAutomationImportWarnings,
  collectJiraAutomationImportReviewSignals,
  isJiraAutomationImportFileSizeAllowed,
  parseJiraAutomationExport,
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
  assert.equal(importRule.canOtherRuleTrigger, true);
  assert.equal(importRule.authorAccountId, 'current-owner');
  assert.equal(importRule.actorAccountId, 'current-owner');
  assert.deepEqual(importRule.projects, [{ projectId: '22222', projectTypeKey: 'software' }]);
  assert.equal(importRule.trigger.id, '__NEW__TRIGGER');
  assert.equal(importRule.components[0].id, '__NEW__COMPONENT__1777600000000');
  assert.equal(importRule.components[1].id, '__NEW__COMPONENT__1777600000001');
});

test('buildJiraAutomationImportRule can block chained rule triggers for safer UI imports', () => {
  const importRule = buildJiraAutomationImportRule(baseRule, {
    projectId: '22222',
    projectTypeKey: 'software',
    allowOtherRuleTrigger: false,
    now: 1777600000050,
  });

  assert.equal(importRule.canOtherRuleTrigger, false);
});

test('buildJiraAutomationImportedRuleName truncates long names to Jira-safe length', () => {
  const importedName = buildJiraAutomationImportedRuleName('A'.repeat(400));

  assert.equal(importedName.length, JIRA_AUTOMATION_IMPORT_MAX_RULE_NAME_LENGTH);
  assert.ok(importedName.startsWith('(Imported by Personal AI) '));
  assert.ok(importedName.endsWith('...'));
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
        jql: 'project = SRC AND status = Done',
      },
    },
    components: [
      {
        component: 'ACTION',
        type: 'jira.issue.outgoing.webhook',
        value: {
          url: 'https://hooks.example.com/SRC/release',
          payload: '{"projectId":"11111"}',
          recipients: 'release-owner@example.com',
        },
      },
    ],
  };

  const summary = summarizeJiraAutomationImportRule(rule);
  const reviewSignals = collectJiraAutomationImportReviewSignals(rule);

  assert.equal(summary.jqlReferenceCount, 1);
  assert.equal(summary.hardcodedUrlCount, 1);
  assert.equal(summary.emailReferenceCount, 1);
  assert.equal(summary.sourceProjectReferenceCount, 3);
  assert.deepEqual(reviewSignals.jqlReferences, ['project = SRC AND status = Done']);
  assert.deepEqual(reviewSignals.hardcodedUrls, ['https://hooks.example.com/SRC/release']);
  assert.deepEqual(reviewSignals.emailReferences, ['release-owner@example.com']);
  assert.ok(reviewSignals.sourceProjectReferences.some((reference) => reference.includes('project = SRC')));
  assert.ok(reviewSignals.sourceProjectReferences.some((reference) => reference.includes('projectId')));
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
        },
      },
    ],
  });

  assert.ok(warnings.some((warning) => warning.includes('Project scope remapping does not rewrite')));
  assert.ok(warnings.some((warning) => warning.includes('JQL or filter')));
  assert.ok(warnings.some((warning) => warning.includes('hard-coded URL')));
  assert.ok(warnings.some((warning) => warning.includes('email or account')));
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
      'schedule',
      'rule-chaining',
      'version-compatibility',
    ],
  );
  assert.equal(checklist.find((item) => item.id === 'target-project')?.severity, 'high');
  assert.equal(checklist.find((item) => item.id === 'external-effects')?.severity, 'high');
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
