import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_MESSAGE_TEXT,
  MAX_PRIMARY_TEXT,
  MAX_VISIBLE_MESSAGES,
  WEB_AGENT_SOURCE_TYPES,
  buildInteractionSceneSnapshot,
  buildJiraOwnerCommentLearningPayloads,
  buildRingCentralComposerContextKey,
  clipSiteContextText,
  getWebAgentSourceTypesForProvider,
  isIgnoredComposerContextMedia,
  isRingCentralComposerCard,
  markRingCentralSelfAuthoredMessages,
  markJiraSelfAuthoredComments,
  sanitizeRingCentralComposerChromeText,
  inheritCollapsedGlipAuthors,
} from '../siteContextAdapters.ts';
import type { ComposerContextItem, ComposerTarget, SiteContextSnapshot } from '../types.ts';

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

test('markRingCentralSelfAuthoredMessages: matches email local, Glip person id, and compact display name', () => {
  const ownReply: ComposerContextItem = {
    type: 'thread_reply',
    sender: 'Esone Qiu',
    text: 'Absolutely, NC Switcher is a great productivity booster.',
    metadata: {
      authorValues: [
        'Esone Qiu',
        'GLIP_PERSON.17215389699',
        '17215389699',
      ],
    },
  };
  const peerReply: ComposerContextItem = {
    type: 'thread_reply',
    sender: 'Venky Iyer',
    text: 'Let’s also demo this tool',
    metadata: {
      authorValues: ['Venky Iyer', 'GLIP_PERSON.1384468406275', '1384468406275'],
    },
  };

  const byEmail = markRingCentralSelfAuthoredMessages(
    [ownReply, peerReply],
    ['esone.qiu@ringcentral.com'],
  );
  assert.equal(byEmail[0].metadata?.isSelf, true);
  assert.equal(byEmail[0].metadata?.authorRole, 'owner');
  assert.equal(byEmail[1].metadata?.isSelf, false);

  const byPersonId = markRingCentralSelfAuthoredMessages(
    [ownReply, peerReply],
    ['GLIP_PERSON.17215389699'],
  );
  assert.equal(byPersonId[0].metadata?.isSelf, true);
  assert.equal(byPersonId[1].metadata?.isSelf, false);
});

test('markRingCentralSelfAuthoredMessages: matches Personal AI userId to Glip display name', () => {
  const marked = markRingCentralSelfAuthoredMessages(
    [
      {
        type: 'thread_reply',
        sender: 'Esone Qiu',
        text: 'I’ll loop the demo in our weekly.',
        metadata: { authorValues: ['Esone Qiu'] },
      },
      {
        type: 'thread_reply',
        sender: 'Alice Qiu',
        text: 'Thanks',
        metadata: { authorValues: ['Alice Qiu'] },
      },
    ],
    ['esone.qiu'],
  );
  assert.equal(marked[0].metadata?.isSelf, true);
  assert.equal(marked[1].metadata?.isSelf, false);
});

test('inheritCollapsedGlipAuthors: copies sender from the previous named card', () => {
  const inherited = inheritCollapsedGlipAuthors([
    {
      sender: 'Esone Qiu',
      authorValues: ['Esone Qiu', 'GLIP_PERSON.20367368195', '20367368195'],
    },
    {
      authorValues: [],
    },
    {
      sender: 'Fred Gu',
      authorValues: ['Fred Gu', 'GLIP_PERSON.1428819795971'],
    },
  ]);

  assert.equal(inherited[1].sender, 'Esone Qiu');
  assert.deepEqual(inherited[1].authorValues, [
    'Esone Qiu',
    'GLIP_PERSON.20367368195',
    '20367368195',
  ]);
  assert.equal(inherited[2].sender, 'Fred Gu');
});

test('isIgnoredComposerContextMedia: drops Personal AI extension icons', () => {
  assert.equal(
    isIgnoredComposerContextMedia({
      url: 'chrome-extension://ekagkmjaaikfljgbkbblfkolkaemooml/icons/icon16.png',
      label: 'Personal AI',
    }),
    true,
  );
  assert.equal(
    isIgnoredComposerContextMedia({
      url: 'https://nc-web-switcher.int.rclabenv.com/guide.png',
      label: 'NC Switcher demo',
    }),
    false,
  );
});

test('sanitizeRingCentralComposerChromeText: strips Improve / Draft for me chrome', () => {
  assert.equal(
    sanitizeRingCentralComposerChromeText(
      '@Venky Iyer Absolutely, NC Switcher is a great productivity booster. I’ll help coordinate the demo in Weekly Sync and make sure Christophe is updated. Improve',
    ),
    '@Venky Iyer Absolutely, NC Switcher is a great productivity booster. I’ll help coordinate the demo in Weekly Sync and make sure Christophe is updated.',
  );
  assert.equal(sanitizeRingCentralComposerChromeText('Draft for me'), '');
  assert.equal(
    sanitizeRingCentralComposerChromeText('this will improve'),
    'this will improve',
  );
});

test('isRingCentralComposerCard: detects the reply editor wrapper', () => {
  const composer = {
    matches: (selector: string) => selector.includes('.ql-editor'),
    querySelector: () => ({ className: 'ql-editor' }),
  } as unknown as HTMLElement;
  const ordinary = {
    matches: () => false,
    querySelector: () => null,
  } as unknown as HTMLElement;
  assert.equal(isRingCentralComposerCard(composer), true);
  assert.equal(isRingCentralComposerCard(ordinary), false);
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

test('WEB_AGENT_SOURCE_TYPES: keeps calendar available for Web AI context packs', () => {
  assert.equal(WEB_AGENT_SOURCE_TYPES.includes('calendar'), true);
  assert.equal(WEB_AGENT_SOURCE_TYPES.includes('user_core'), false);
  assert.equal(WEB_AGENT_SOURCE_TYPES.includes('reflection_thread'), true);
});

test('getWebAgentSourceTypesForProvider: excludes current provider history from Web AI context packs', () => {
  const chatgpt = getWebAgentSourceTypesForProvider('chatgpt');
  assert.equal(chatgpt.includes('chatgpt'), false);
  assert.equal(chatgpt.includes('doubao_chat'), true);
  assert.equal(chatgpt.includes('codex_cli'), true);
  assert.equal(chatgpt.includes('calendar'), true);

  const doubao = getWebAgentSourceTypesForProvider('doubao');
  assert.equal(doubao.includes('doubao'), false);
  assert.equal(doubao.includes('doubao_chat'), false);
  assert.equal(doubao.includes('chatgpt'), true);

  const claude = getWebAgentSourceTypesForProvider('claude');
  assert.deepEqual(claude, WEB_AGENT_SOURCE_TYPES);
});

test('buildInteractionSceneSnapshot: classifies Jira reading, RingCentral estimate discussion, and Jira comment composer', () => {
  const jiraSnapshot: SiteContextSnapshot = {
    adapterId: 'jira-issue',
    surface: 'jira_issue',
    contextType: 'jira_issue',
    scenario: 'jira_comment',
    contextKey: 'jira:MTR-148115',
    title: 'MTR-148115: Estimate review',
    url: 'https://jira.example/browse/MTR-148115',
    primaryText: 'MTR-148115 Estimate review',
    identifiers: { issueKey: 'MTR-148115' },
    visibleFields: [
      {
        name: 'DEV Estimate New',
        value: '0.4',
        rawText: 'DEV Estimate New: 0.4',
      },
    ],
    keywords: ['MTR-148115', 'estimate'],
  };

  const jiraRead = buildInteractionSceneSnapshot(jiraSnapshot, {
    surface: 'memory_lens',
  });
  assert.equal(jiraRead.sceneType, 'jira_issue_reading');
  assert.equal(jiraRead.userMode, 'read');
  assert.equal(jiraRead.visibleFacts?.[0].name, 'DEV Estimate New');
  assert.equal(jiraRead.admission?.state, 'passive_ready');

  const ringCentralSnapshot: SiteContextSnapshot = {
    adapterId: 'ringcentral-message',
    surface: 'ringcentral_thread',
    contextType: 'message_thread',
    scenario: 'thread_reply',
    contextKey: 'glip:eng-planning',
    title: 'eng-planning',
    url: 'https://app.ringcentral.com/messages/teams/eng-planning',
    primaryText: 'David: MTR-148115 这个 DEV estimate 现在按多少沟通？',
    identifiers: { groupId: 'eng-planning' },
    visibleMessages: [
      {
        sender: 'David',
        text: 'MTR-148115 这个 DEV estimate 现在按多少沟通？',
      },
    ],
    keywords: ['MTR-148115', 'estimate'],
  };
  const discussion = buildInteractionSceneSnapshot(ringCentralSnapshot, {
    surface: 'memory_lens',
  });
  assert.equal(discussion.sceneType, 'ringcentral_estimate_discussion');
  assert.equal(discussion.admission?.state, 'passive_ready');

  const commentElement = {
    tagName: 'DIV',
    isContentEditable: true,
    classList: [],
    textContent: '准备说明这张票的 estimate',
    getAttribute(name: string) {
      return name === 'role' ? 'textbox' : null;
    },
    closest() {
      return null;
    },
    contains() {
      return true;
    },
  } as unknown as HTMLElement;
  const target: ComposerTarget = {
    element: commentElement,
    kind: 'contenteditable',
    mode: 'comment',
  };
  const commentScene = buildInteractionSceneSnapshot(jiraSnapshot, {
    surface: 'compose_assist',
    target,
    activeElement: commentElement,
  });
  assert.equal(commentScene.sceneType, 'jira_comment_composing');
  assert.equal(commentScene.userMode, 'comment');
  assert.equal(commentScene.surface, 'compose_assist');
  assert.equal(commentScene.admission?.state, 'composer_ready');
});

test('RingCentral site context keeps a large per-message cap and still hard-clips megabyte posts', () => {
  assert.equal(MAX_VISIBLE_MESSAGES, 8);
  assert.equal(MAX_MESSAGE_TEXT, 4000);
  assert.equal(MAX_PRIMARY_TEXT, 8000);

  const filler = 'Weekly Sync status. '.repeat(20);
  const tail =
    'WAC DF production 2.4.1 MTR-148115 https://example.com/download/build.zip';
  const longPost = `${filler}${tail}`;
  assert.ok(longPost.length > 280);
  assert.ok(longPost.length < MAX_MESSAGE_TEXT);

  const kept = clipSiteContextText(longPost, MAX_MESSAGE_TEXT);
  assert.equal(kept.includes('...'), false);
  assert.match(kept, /WAC DF/);
  assert.match(kept, /MTR-148115/);
  assert.match(kept, /2\.4\.1/);
  assert.match(kept, /download\/build\.zip/);

  const oversized = `${'x'.repeat(MAX_MESSAGE_TEXT + 80)} UNIQUE_TAIL_TOKEN`;
  const clipped = clipSiteContextText(oversized, MAX_MESSAGE_TEXT);
  assert.equal(clipped.endsWith('...'), true);
  assert.equal(clipped.includes('UNIQUE_TAIL_TOKEN'), false);
  assert.ok(clipped.length <= MAX_MESSAGE_TEXT + 3);

  const joined = Array.from({ length: 8 }, (_, index) =>
    clipSiteContextText(`${'n'.repeat(MAX_MESSAGE_TEXT)} msg-${index}`, MAX_MESSAGE_TEXT),
  ).join('\n');
  const primary = clipSiteContextText(joined, MAX_PRIMARY_TEXT);
  assert.equal(primary.endsWith('...'), true);
  assert.ok(primary.length <= MAX_PRIMARY_TEXT + 3);
});

test('RingCentral assist context key stays stable when visible messages churn', () => {
  const threadKey = buildRingCentralComposerContextKey({
    conversationId: '6543474694',
    surface: 'ringcentral_thread',
    threadRootId: 'venky-weekly-sync',
    mode: 'thread',
  });
  assert.equal(
    threadKey,
    'ringcentral|6543474694|ringcentral_thread|venky-weekly-sync|thread',
  );
  assert.equal(
    buildRingCentralComposerContextKey({
      conversationId: '6543474694',
      surface: 'ringcentral_thread',
      threadRootId: 'venky-weekly-sync',
      mode: 'thread',
    }),
    threadKey,
  );
  assert.notEqual(
    threadKey,
    buildRingCentralComposerContextKey({
      conversationId: '6543474694',
      surface: 'ringcentral_message',
      mode: 'main',
    }),
  );
});
