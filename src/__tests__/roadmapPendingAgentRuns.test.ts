import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePendingAgentCreateRun,
  partitionPendingAgentCreateRuns,
  remainingAgentPollMs,
  removePendingAgentCreateRun,
  upsertPendingAgentCreateRun,
} from '../roadmapPendingAgentRuns.js';

test('normalizePendingAgentCreateRun drops incomplete rows', () => {
  assert.equal(normalizePendingAgentCreateRun(null), null);
  assert.equal(normalizePendingAgentCreateRun({ taskId: 't' }), null);
  const run = normalizePendingAgentCreateRun({
    taskId: 'roadmap:team:abc',
    teamId: 'team',
    token: 'tok',
    parent: { itemKey: 'draft-1', issueType: 'Epic', projectKey: 'MILO' },
    childDraftIds: ['c1', '', 'c2'],
    startedAt: 100,
  });
  assert.deepEqual(run, {
    taskId: 'roadmap:team:abc',
    teamId: 'team',
    token: 'tok',
    parent: { itemKey: 'draft-1', issueType: 'Epic', projectKey: 'MILO' },
    childDraftIds: ['c1', 'c2'],
    startedAt: 100,
  });
});

test('upsert replaces the same taskId', () => {
  const first = {
    taskId: 't1',
    teamId: 'team',
    token: null,
    parent: null,
    childDraftIds: ['a'],
    startedAt: 1,
  };
  const second = { ...first, childDraftIds: ['a', 'b'], startedAt: 2 };
  const list = upsertPendingAgentCreateRun(
    upsertPendingAgentCreateRun([], first),
    second,
  );
  assert.equal(list.length, 1);
  assert.deepEqual(list[0]?.childDraftIds, ['a', 'b']);
});

test('removePendingAgentCreateRun is a no-op for unknown ids', () => {
  const list = [
    {
      taskId: 't1',
      teamId: 'team',
      token: null,
      parent: null,
      childDraftIds: [],
      startedAt: 1,
    },
  ];
  assert.equal(removePendingAgentCreateRun(list, 'missing').length, 1);
  assert.equal(removePendingAgentCreateRun(list, 't1').length, 0);
});

test('remainingAgentPollMs uses leftover budget then a one-shot floor', () => {
  assert.equal(
    remainingAgentPollMs({
      startedAt: 0,
      now: 5 * 60 * 1000,
      budgetMs: 30 * 60 * 1000,
    }),
    25 * 60 * 1000,
  );
  assert.equal(
    remainingAgentPollMs({
      startedAt: 0,
      now: 40 * 60 * 1000,
      budgetMs: 30 * 60 * 1000,
      minMs: 8_000,
    }),
    8_000,
  );
});

test('partitionPendingAgentCreateRuns splits on TTL', () => {
  const now = 2_000_000;
  const { active, expired } = partitionPendingAgentCreateRuns(
    [
      {
        taskId: 'fresh',
        teamId: 't',
        token: null,
        parent: null,
        childDraftIds: [],
        startedAt: now - 60_000,
      },
      {
        taskId: 'old',
        teamId: 't',
        token: null,
        parent: null,
        childDraftIds: [],
        startedAt: now - 25 * 60 * 60 * 1000,
      },
    ],
    now,
    24 * 60 * 60 * 1000,
  );
  assert.deepEqual(
    active.map((r) => r.taskId),
    ['fresh'],
  );
  assert.deepEqual(
    expired.map((r) => r.taskId),
    ['old'],
  );
});
