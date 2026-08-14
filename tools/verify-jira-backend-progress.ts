import assert from 'node:assert/strict';

import {
  formatBackendProgressSource,
  getJiraIssueLinkRelationship,
  isSameJiraIssue,
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

console.log('Jira Backend Progress policy verification passed.');
