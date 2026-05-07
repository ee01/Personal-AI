import test from 'node:test';
import assert from 'node:assert/strict';

import { getJiraAutomationRuleUrl } from '../botAutomationConfig.js';

test('builds Jira Automation rule URLs from stored rule metadata', () => {
  const url = getJiraAutomationRuleUrl({
    jiraUrl: 'https://jira.example.com/',
    projectKey: 'MTR',
    ruleId: '1646',
  });

  assert.equal(url, 'https://jira.example.com/jira/software/c/projects/MTR/automation#/rule/1646');
});

test('returns an empty URL when rule metadata is incomplete', () => {
  assert.equal(getJiraAutomationRuleUrl({ jiraUrl: 'https://jira.example.com', projectKey: 'MTR' }), '');
  assert.equal(getJiraAutomationRuleUrl(null), '');
});

