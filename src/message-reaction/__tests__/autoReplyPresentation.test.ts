import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAutoReplyTopic } from '../autoReplyPresentation.js';

test('buildAutoReplyTopic falls back to message content when summary is missing', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: 'Morgan Lee',
      groupId: 'team-1',
      groupName: 'Support',
      messageContent: 'Please review the escalation before EOD.',
      datetime: '2026-05-01T08:00:00.000Z',
      postId: 'post-1',
    }),
    '自动答复 Morgan「Please review the escalation before EOD.」',
  );
});

test('buildAutoReplyTopic avoids repeating sender name from the summary', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: 'Alex Chen',
      groupId: 'team-1',
      groupName: 'Support',
      messageContent: 'Can someone confirm the action owner?',
      summary: 'Alex asks who owns the action',
      datetime: '2026-05-01T08:00:00.000Z',
      postId: 'post-2',
    }),
    '自动答复「Alex asks who owns the action」',
  );
});

test('buildAutoReplyTopic has a stable fallback for empty context text', () => {
  assert.equal(
    buildAutoReplyTopic({
      sender: '',
      groupId: '',
      groupName: '',
      messageContent: '',
      summary: '   ',
      datetime: '2026-05-01T08:00:00.000Z',
    }),
    '自动答复「消息」',
  );
});
