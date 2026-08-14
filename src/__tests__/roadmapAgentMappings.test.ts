import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assignMappingsToRows,
  parseAgentCreateArtifact,
} from '../roadmapAgentMappings.js';

test('parseAgentCreateArtifact keeps the legacy jiraKey-only contract', () => {
  const parsed = parseAgentCreateArtifact(
    '{"mappings":[{"draftId":"a","jiraKey":"MILO-1"}]}',
  );
  assert.equal(parsed.partial, false);
  assert.deepEqual(parsed.mappings, [{ draftId: 'a', jiraKey: 'MILO-1' }]);
});

test('parseAgentCreateArtifact accepts partial success with error rows', () => {
  const parsed = parseAgentCreateArtifact(`
    {"partial":true,"mappings":[
      {"draftId":"ok","jiraKey":"MILO-2"},
      {"draftId":"bad","error":"assignee 找不到"}
    ]}
  `);
  assert.equal(parsed.partial, true);
  assert.equal(parsed.mappings[0]?.jiraKey, 'MILO-2');
  assert.equal(parsed.mappings[1]?.error, 'assignee 找不到');
});

test('parseAgentCreateArtifact reads fenced JSON from a failed Agent summary', () => {
  const parsed = parseAgentCreateArtifact(
    '创建中断\n```json\n{"mappings":[{"draftId":"x","jiraKey":"NOVA-9"}]}\n```',
    'failed: browser bridge',
  );
  assert.equal(parsed.mappings[0]?.jiraKey, 'NOVA-9');
});

test('assignMappingsToRows writes back successes and isolates failures', () => {
  const assigned = assignMappingsToRows({
    parentItemKey: 'draft-parent',
    childDraftIds: ['c1', 'c2', 'c3'],
    mappings: [
      { draftId: 'draft-parent', jiraKey: 'MILO-10' },
      { draftId: 'c1', jiraKey: 'MILO-11' },
      { draftId: 'c2', error: 'sprint 查询失败' },
    ],
    fallbackError: '整单 failed：网关超时',
  });
  assert.equal(assigned.parent?.jiraKey, 'MILO-10');
  assert.equal(assigned.children[0]?.jiraKey, 'MILO-11');
  assert.equal(assigned.children[1]?.error, 'sprint 查询失败');
  assert.equal(assigned.children[2]?.error, '整单 failed：网关超时');
});
