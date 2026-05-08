import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getJiraAutomationRuleUrl,
  shouldRecreateExecutorRuleForRingCentralSenderUpgrade,
} from '../botAutomationConfig.js';

test('builds Jira Automation rule URLs from stored rule metadata', () => {
  const url = getJiraAutomationRuleUrl({
    jiraUrl: 'https://jira.example.com/',
    projectKey: 'MTR',
    ruleId: '1646',
  });

  assert.equal(url, 'https://jira.example.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=MTR#/rule/1646');
});

test('returns an empty URL when rule metadata is incomplete', () => {
  assert.equal(getJiraAutomationRuleUrl({ jiraUrl: 'https://jira.example.com', projectKey: 'MTR' }), '');
  assert.equal(getJiraAutomationRuleUrl(null), '');
});

test('recreates executor rule when enabling RingCentral sender from legacy config', () => {
  const currentConfig = {
    botAutomation: {
      executorRule: {
        ruleId: '2154',
        ruleName: '[Esone] Scheduled Messages v1.3.1',
        webhookUrl: 'https://script.example/exec',
        projectKey: 'MTR',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-08T00:00:00.000Z',
      },
    },
  };

  assert.equal(
    shouldRecreateExecutorRuleForRingCentralSenderUpgrade(currentConfig, {
      enabled: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      jwt: 'jwt',
    }),
    true,
  );
});

test('does not recreate executor rule when RingCentral sender was already configured', () => {
  const currentConfig = {
    botAutomation: {
      executorRule: {
        ruleId: '2154',
        ruleName: '[Esone] Scheduled Messages v1.4.0',
        webhookUrl: 'https://script.example/exec',
        projectKey: 'MTR',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-08T00:00:00.000Z',
      },
    },
    ringCentralSender: {
      enabled: true,
      clientId: 'old-client-id',
      clientSecret: 'old-client-secret',
      jwt: 'old-jwt',
    },
  };

  assert.equal(
    shouldRecreateExecutorRuleForRingCentralSenderUpgrade(currentConfig, {
      enabled: true,
      clientId: 'new-client-id',
      clientSecret: 'new-client-secret',
      jwt: 'new-jwt',
    }),
    false,
  );
});

test('does not recreate executor rule when executor rule already supports RingCentral sender', () => {
  const currentConfig = {
    botAutomation: {
      executorRule: {
        ruleId: '2154',
        ruleName: '[Esone] Scheduled Messages v1.4.0',
        webhookUrl: 'https://script.example/exec',
        projectKey: 'MTR',
        jiraUrl: 'https://jira.example.com',
        createdAt: '2026-05-08T00:00:00.000Z',
        ruleVersion: '1.4.0',
      },
    },
  };

  assert.equal(
    shouldRecreateExecutorRuleForRingCentralSenderUpgrade(currentConfig, {
      enabled: true,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      jwt: 'jwt',
    }),
    false,
  );
});
