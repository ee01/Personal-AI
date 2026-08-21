import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ScheduledMessage } from '../types.js';
import {
  mergeScheduledMessageUpdate,
  resolveAutomationLinkForSave,
  resolveJiraRuleNameSyncLink,
} from '../jiraAutomationLink.js';

const hostedLink =
  'https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=NOVA#/rule/2956';

function hostedMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    ID: 'msg_hosted',
    Topic: 'NOVA weekly',
    Content: 'run rule',
    Push_Method: 'JiraAutomation',
    Target_Type: 'private',
    Status: 'Active',
    Automation_Link: hostedLink,
    AI_Endpoint: 'POST https://example.invalid/webhook',
    ...overrides,
  };
}

test('edit save keeps the hosted Automation_Link when the form omitted it', () => {
  assert.equal(
    resolveAutomationLinkForSave({
      pushMethod: 'JiraAutomation',
      formLink: undefined,
      existingLink: hostedLink,
    }),
    hostedLink,
  );
});

test('edit save prefers the form Automation_Link when present', () => {
  assert.equal(
    resolveAutomationLinkForSave({
      pushMethod: 'JiraAutomation',
      formLink: ' https://jira.example/rule/1 ',
      existingLink: hostedLink,
    }),
    'https://jira.example/rule/1',
  );
});

test('switching to Outreach still keeps an existing Automation_Link', () => {
  assert.equal(
    resolveAutomationLinkForSave({
      pushMethod: 'Outreach',
      formLink: undefined,
      existingLink: hostedLink,
    }),
    hostedLink,
  );
});

test('updateMessage merge does not let undefined wipe Automation_Link', () => {
  const previous = hostedMessage();
  const merged = mergeScheduledMessageUpdate(previous, {
    Topic: 'NOVA weekly renamed',
    Automation_Link: undefined,
    AI_Endpoint: previous.AI_Endpoint,
  });

  assert.equal(merged.Topic, 'NOVA weekly renamed');
  assert.equal(merged.Automation_Link, hostedLink);
});

test('updateMessage merge still allows an explicit empty Automation_Link', () => {
  const merged = mergeScheduledMessageUpdate(hostedMessage(), {
    Automation_Link: '',
  });
  assert.equal(merged.Automation_Link, '');
});

test('title sync can use saved, form, or in-memory editing link', () => {
  assert.equal(
    resolveJiraRuleNameSyncLink({
      savedLink: undefined,
      formLink: undefined,
      editingLink: hostedLink,
    }),
    hostedLink,
  );
  assert.equal(
    resolveJiraRuleNameSyncLink({
      savedLink: hostedLink,
      formLink: undefined,
      editingLink: undefined,
    }),
    hostedLink,
  );
  assert.equal(
    resolveJiraRuleNameSyncLink({
      savedLink: '',
      formLink: '',
      editingLink: '',
    }),
    undefined,
  );
});

test('edit form initializes and saves Automation_Link instead of omitting it', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const managerSource = readFileSync(
    resolve(__dirname, '../ScheduledMessagesManager.tsx'),
    'utf8',
  );

  assert.match(
    managerSource,
    /Automation_Link: editingMessage\.Automation_Link,/,
    'edit form must copy the hosted Automation_Link into the draft',
  );
  assert.match(
    managerSource,
    /resolveAutomationLinkForSave\(\{[\s\S]*existingLink: isEditMode \? editingMessage\?\.Automation_Link/,
    'submit must fall back to the existing hosted link when the draft omitted it',
  );
  assert.match(
    managerSource,
    /resolveJiraRuleNameSyncLink\(\{[\s\S]*savedLink: savedMessage\.Automation_Link/,
    'topic sync must keep working after the first hosted edit, not only from the pre-save in-memory link',
  );
});
