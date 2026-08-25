import assert from 'node:assert/strict';

import {
  formatBackendProgressSource,
  getJiraIssueLinkRelationship,
  isSameJiraIssue,
  prepareBackendProgressItems,
  shouldIncludeBackendDependency,
} from '../src/jiraBackendProgress.ts';

assert.equal(isSameJiraIssue('RCV-153451', 'rcv-153451'), true);
assert.equal(isSameJiraIssue('RCV-153451', 'RCV-152720'), false);

assert.equal(
  shouldIncludeBackendDependency('RCV-153451', 'RCV-152720', 'issue_links'),
  true,
  'same-project Linked Issues and Epic Issue Links must remain eligible',
);
assert.equal(
  shouldIncludeBackendDependency('RCV-153451', 'RCV-152720', 'init_parent'),
  false,
  'same-project tickets discovered through INIT/Parent must remain filtered',
);
assert.equal(
  shouldIncludeBackendDependency('RCV-153451', 'MTR-147003', 'init_parent'),
  true,
  'cross-project INIT/Parent dependencies must remain eligible',
);
assert.equal(
  shouldIncludeBackendDependency('RCV-153451', 'RCV-153451', 'issue_links'),
  false,
  'the current issue itself must never be shown as a dependency',
);

assert.equal(
  getJiraIssueLinkRelationship({
    type: { outward: 'clones', inward: 'is cloned by' },
    outwardIssue: { key: 'RCV-153296' },
  }),
  'clones',
);
assert.equal(
  getJiraIssueLinkRelationship({
    type: { outward: 'clones', inward: 'is cloned by' },
    inwardIssue: { key: 'RCV-153452' },
  }),
  'is cloned by',
);
assert.equal(formatBackendProgressSource('epic', 'depends on'), 'epic:depends on');
assert.equal(formatBackendProgressSource('user_story', 'depends on'), 'user_story');
assert.equal(formatBackendProgressSource('epic', null), 'epic');

const limited = prepareBackendProgressItems([
  { dependencyTicketKey: 'FIJI-108394', source: 'parent_impact_layer:Apps - Jupiter', issueStatus: 'Initial' },
  { dependencyTicketKey: 'FIJI-98255', source: 'parent_impact_layer:Apps - Jupiter', issueStatus: 'Initial' },
  { dependencyTicketKey: 'RCV-154386', source: 'parent_child_issue', issueStatus: 'Initial' },
  { dependencyTicketKey: 'RCV-152284', source: 'parent_child_issue', issueStatus: 'Cancelled' },
  { dependencyTicketKey: 'RCV-151775', source: 'parent_child_issue', issueStatus: 'Cancelled' },
  { dependencyTicketKey: 'RCV-141220', source: 'parent_child_issue', issueStatus: 'Initial' },
], 'MTR-141170');
assert.equal(limited.map(item => item.dependencyTicketKey).join(','), 'FIJI-108394,FIJI-98255,RCV-154386,RCV-141220');
assert.equal(limited.some(item => item.dependencyTicketKey === 'RCV-152284' || item.dependencyTicketKey === 'RCV-151775'), false);

console.log('Jira Backend Progress policy verification passed.');
