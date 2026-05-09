import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildJiraOwnerCommentLearningPayloads,
  markRingCentralSelfAuthoredMessages,
  markJiraSelfAuthoredComments,
} from '../siteContextAdapters.ts';
import type { ComposerContextItem, SiteContextSnapshot } from '../types.ts';

test('markJiraSelfAuthoredComments: only current Jira user comments are marked self', () => {
  const comments: ComposerContextItem[] = [
    {
      type: 'jira_comment',
      id: '10001',
      sender: 'Esone Qiu',
      text: 'I will own the rollout.',
      metadata: { commentId: '10001', issueKey: 'PAI-7' },
    },
    {
      type: 'jira_comment',
      id: '10002',
      sender: 'Alice',
      text: 'Can you review this?',
      metadata: { commentId: '10002', issueKey: 'PAI-7' },
    },
  ];

  const marked = markJiraSelfAuthoredComments(comments, [
    'esone.qiu',
    'Esone Qiu',
  ]);

  assert.equal(marked[0].metadata?.isSelf, true);
  assert.equal(marked[0].metadata?.authorRole, 'owner');
  assert.equal(marked[1].metadata?.isSelf, false);
  assert.equal(marked[1].metadata?.authorRole, undefined);
});

test('markRingCentralSelfAuthoredMessages: marks owner messages from display name and avatar id', () => {
  const messages: ComposerContextItem[] = [
    {
      type: 'message',
      sender: 'Esone Qiu 😏 凡事先让 AI 跑一遍~',
      text: '我也上传了',
      metadata: {
        authorValues: [
          'Esone Qiu 😏 凡事先让 AI 跑一遍~',
          'GLIP_PERSON.20367368195',
          '20367368195',
        ],
      },
    },
    {
      type: 'message',
      sender: 'Zong Zheng',
      text: '收到',
      metadata: {
        authorValues: ['Zong Zheng', 'GLIP_PERSON.9999', '9999'],
      },
    },
    {
      type: 'message',
      sender: 'Alice Qiu',
      text: '这个我来处理',
      metadata: {
        authorValues: ['Alice Qiu'],
      },
    },
  ];

  const marked = markRingCentralSelfAuthoredMessages(messages, [
    'Esone Qiu',
    'esone.qiu@ringcentral.com',
    '20367368195',
  ]);

  assert.equal(marked[0].metadata?.isSelf, true);
  assert.equal(marked[0].metadata?.authorRole, 'owner');
  assert.equal(marked[1].metadata?.isSelf, false);
  assert.equal(marked[1].metadata?.authorRole, undefined);
  assert.equal(marked[2].metadata?.isSelf, false);
  assert.equal(marked[2].metadata?.authorRole, undefined);
});

test('buildJiraOwnerCommentLearningPayloads: creates jira owner learning payloads only', () => {
  const snapshot: SiteContextSnapshot = {
    adapterId: 'jira-issue',
    surface: 'jira_issue',
    contextType: 'jira_issue',
    scenario: 'jira_comment',
    contextKey: 'jira:PAI-7',
    title: 'PAI-7: Owner authored signal',
    url: 'https://jira.example/browse/PAI-7',
    primaryText: 'PAI-7 Owner authored signal',
    identifiers: { issueKey: 'PAI-7' },
    contextItems: [
      {
        type: 'jira_comment',
        id: '10001',
        sender: 'Esone Qiu',
        text: 'I prefer direct Jira updates.',
        url: 'https://jira.example/browse/PAI-7#comment-10001',
        metadata: {
          authorRole: 'owner',
          isSelf: true,
          issueKey: 'PAI-7',
          commentId: '10001',
          sourceUrl: 'https://jira.example/browse/PAI-7#comment-10001',
        },
      },
      {
        type: 'jira_comment',
        id: '10002',
        sender: 'Alice',
        text: 'External comment',
        metadata: { isSelf: false, issueKey: 'PAI-7', commentId: '10002' },
      },
    ],
  };

  const payloads = buildJiraOwnerCommentLearningPayloads(snapshot);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].sourceType, 'jira');
  assert.equal(payloads[0].metadata.authorRole, 'owner');
  assert.equal(payloads[0].metadata.isSelf, true);
  assert.equal(payloads[0].metadata.issueKey, 'PAI-7');
  assert.equal(payloads[0].metadata.commentId, '10001');
  assert.equal(
    payloads[0].metadata.sourceUrl,
    'https://jira.example/browse/PAI-7#comment-10001',
  );
  assert.deepEqual(payloads[0].metadata.learningPurposes, [
    'owner-authored-comment',
    'jira-comment-style',
  ]);
});
