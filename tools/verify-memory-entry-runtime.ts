import assert from 'node:assert/strict';

import {
  getMatchedAutoReplyItem,
  type TopicItemWithAutoReply,
} from '../src/message-reaction/AutoReplyHandler.ts';
import { buildRuleText } from '../src/utils/ruleTextBuilder.ts';
import {
  buildRuntimeWatchRules,
  filterWatchRulesForMessageContext,
  filterWatchRulesForMessageGroups,
  getFirstManualItemFromMatchedRules,
  isManualConcernedItem,
  resolveMatchedWatchRules,
} from '../src/watchRules.ts';
import {
  getDigestDeliveryItems,
  getImmediateNotificationItem,
} from '../src/messageAnalysisDelivery.ts';
import type { OutreachSession } from '../src/services/MemoryServiceClient.ts';

const manualRules: TopicItemWithAutoReply[] = [
  {
    id: 'manual-1',
    text: 'Watch blocker updates',
    expiredAt: 0,
    notifyMethod: 'bot',
    filterGroup: 'Release Chat',
  },
  {
    id: 'manual-follow-1',
    text: 'Follow thread updates',
    expiredAt: 0,
    notifyMethod: 'bot',
    followThread: true,
    followConfig: {
      originalMessage: {
        postId: 'post-1',
        teamId: 'team-1',
        teamName: 'Team Standup',
        sender: 'Alice',
        content: 'Original blocker',
        datetime: '2026-04-15T00:00:00.000Z',
        messageUrl: 'https://example.com/post-1',
      },
      createdAt: '2026-04-15T00:00:00.000Z',
      relatedMessages: [],
    },
  },
  {
    id: 'manual-ai-short-scope',
    text: 'Watch AI planning updates',
    expiredAt: 0,
    notifyMethod: 'bot',
    filterGroup: 'AI',
  },
  {
    id: 'outreach:legacy-system-item',
    text: 'legacy internal rule',
    expiredAt: 0,
    // intentionally invalid legacy contamination case
  },
  {
    id: 'manual-auto-reply-scope',
    text: 'Auto reply to AI research requests',
    expiredAt: 0,
    notifyMethod: 'bot',
    filterGroup: 'AI Research',
    filterSender: 'Morgan Lee',
    autoReply: true,
    autoReplyConfig: {
      enabled: true,
      replyContent: 'I will check.',
      useAIGenerate: false,
      reviewMode: 'manual',
    },
  },
  {
    id: 'manual-multi-scope',
    text: 'Watch release and SDK planning updates',
    expiredAt: 0,
    notifyMethod: 'bot',
    filterGroup: 'Release Chat, SDK Updates',
    filterSender: 'Morgan Lee; Alice',
  },
];

const outreachSessions: OutreachSession[] = [
  {
    id: 'session-before-dispatch',
    targetType: 'group',
    targetRef: 'ops-room',
    renderedQuestion: 'release risk answered?',
    status: 'scheduled',
    requiresApproval: false,
    followupCount: 0,
    maxFollowup: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'session-before-followup',
    targetType: 'group',
    targetRef: 'sdk-updates',
    renderedQuestion: 'migration guide published?',
    status: 'waiting_reply',
    requiresApproval: false,
    followupCount: 0,
    maxFollowup: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const observationBaselineSeconds = Math.floor(
  Date.parse('2026-04-15T00:00:00.000Z') / 1000,
);

function main() {
  assert.equal(isManualConcernedItem(manualRules[0]), true);
  assert.equal(isManualConcernedItem(manualRules[3]), false);

  const runtimeRules = buildRuntimeWatchRules({
    manualItems: manualRules,
    outreachSessions,
  });

  const ruleRefs = runtimeRules.map((rule) => rule.ruleRef);
  assert.deepEqual(ruleRefs, [
    'manual:manual-1',
    'manual:manual-follow-1',
    'manual:manual-ai-short-scope',
    'manual:manual-auto-reply-scope',
    'manual:manual-multi-scope',
    'outreach:session-before-dispatch',
    'outreach:session-before-followup',
  ]);

  const releaseRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'Release Chat',
    groupId: 'release-chat',
    sender: 'Morgan Lee',
  });
  assert.deepEqual(
    releaseRules.map((rule) => rule.ruleRef),
    ['manual:manual-1', 'manual:manual-follow-1', 'manual:manual-multi-scope'],
  );

  const sdkAliceRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'SDK Updates',
    groupId: 'sdk-updates',
    sender: 'Alice',
  });
  assert.ok(
    sdkAliceRules.some((rule) => rule.ruleRef === 'manual:manual-multi-scope'),
    'comma/semicolon separated scopes should match any sender and group candidate',
  );

  const sdkPriyaRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'SDK Updates',
    groupId: 'sdk-updates',
    sender: 'Priya',
  });
  assert.equal(
    sdkPriyaRules.some((rule) => rule.ruleRef === 'manual:manual-multi-scope'),
    false,
    'multi-scope rule still requires both configured dimensions to match',
  );

  const sdkRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'sdk-updates',
    groupId: 'sdk-updates',
    sender: 'James Lee',
  });
  assert.deepEqual(
    sdkRules.map((rule) => rule.ruleRef),
    ['manual:manual-follow-1', 'outreach:session-before-followup'],
  );

  const baselineRules = buildRuntimeWatchRules({
    manualItems: [],
    outreachSessions: [
      {
        id: 'session-with-baseline',
        targetType: 'group',
        targetRef: 'sdk-updates',
        targetResolvedChatId: 'sdk-updates',
        renderedQuestion: 'migration guide 发布了吗？',
        status: 'waiting_reply',
        requiresApproval: false,
        followupCount: 0,
        maxFollowup: 2,
        createdAt: observationBaselineSeconds,
        updatedAt: observationBaselineSeconds,
      },
    ],
  });
  assert.deepEqual(
    filterWatchRulesForMessageContext(baselineRules, {
      groupName: 'SDK Updates',
      groupId: 'sdk-updates',
      datetime: '2026-04-14T23:59:00.000Z',
    }).map((rule) => rule.ruleRef),
    [],
    'system observation rules must not match evidence older than their baseline',
  );
  assert.deepEqual(
    filterWatchRulesForMessageContext(baselineRules, {
      groupName: 'SDK Updates',
      groupId: 'sdk-updates',
      datetime: '2026-04-15T00:01:00.000Z',
    }).map((rule) => rule.ruleRef),
    ['outreach:session-with-baseline'],
    'system observation rules should still match fresh target-channel evidence',
  );
  assert.deepEqual(
    filterWatchRulesForMessageGroups(baselineRules, [
      {
        groupName: 'SDK Updates',
        groupId: 'sdk-updates',
        timestamps: [
          '2026-04-14T23:59:00.000Z',
          '2026-04-15T00:02:00.000Z',
        ],
      },
    ]).map((rule) => rule.ruleRef),
    ['outreach:session-with-baseline'],
    'group-level prefilter should keep a system rule when any message is inside the observation window',
  );
  assert.deepEqual(
    resolveMatchedWatchRules({
      watchRules: baselineRules,
      matchedRuleRefs: ['outreach:session-with-baseline'],
      messageContext: {
        groupName: 'SDK Updates',
        groupId: 'sdk-updates',
        datetime: '2026-04-14T23:59:00.000Z',
      },
    }).watchRules,
    [],
    'final resolution must reject stale system-rule refs hallucinated by the model',
  );

  const aiResearchRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'AI Research',
    groupId: 'ai-research',
    sender: 'Priya',
  });
  assert.ok(
    aiResearchRules.some(
      (rule) => rule.ruleRef === 'manual:manual-ai-short-scope',
    ),
    'short scope token should match a full group token',
  );

  const dailyStandupRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'Daily Standup',
    groupId: 'daily-standup',
    sender: 'Priya',
  });
  assert.equal(
    dailyStandupRules.some(
      (rule) => rule.ruleRef === 'manual:manual-ai-short-scope',
    ),
    false,
    'short scope token must not match inside an unrelated word',
  );

  const unrelatedScopedMatch = resolveMatchedWatchRules({
    watchRules: runtimeRules,
    matchedRuleRefs: ['manual:manual-1'],
    messageContext: {
      groupName: 'Random Chat',
      groupId: 'random-chat',
      sender: 'Morgan',
    },
  });
  assert.deepEqual(
    unrelatedScopedMatch.watchRules,
    [],
    'manual rule must not resolve outside filterGroup',
  );

  const shortScopeFalsePositiveMatch = resolveMatchedWatchRules({
    watchRules: runtimeRules,
    matchedRuleRefs: ['manual:manual-ai-short-scope'],
    messageContext: {
      groupName: 'Daily Standup',
      groupId: 'daily-standup',
      sender: 'Priya',
    },
  });
  assert.deepEqual(
    shortScopeFalsePositiveMatch.watchRules,
    [],
    'resolved rule refs must still respect token-aware scope filtering',
  );

  const autoReplyScopeMatch = getMatchedAutoReplyItem(
    {
      matchedRule: '',
      matchedRuleRefs: ['manual:manual-auto-reply-scope'],
      matchedRuleIds: [],
      messageContext: {
        sender: 'morgan lee',
        groupId: 'ai-research',
        groupName: 'ai research',
        messageContent: 'Can you send a quick update?',
        datetime: '2026-05-06T00:00:00.000Z',
        postId: 'post-auto-1',
      },
    },
    manualRules,
  );
  assert.equal(
    autoReplyScopeMatch?.id,
    'manual-auto-reply-scope',
    'auto reply should reuse token-aware, case-insensitive scope matching',
  );

  const reorderedRuntimeRules = buildRuntimeWatchRules({
    manualItems: [manualRules[1], manualRules[0], manualRules[2]],
    outreachSessions: [outreachSessions[1], outreachSessions[0]],
  });
  const stableMatch = resolveMatchedWatchRules({
    watchRules: reorderedRuntimeRules,
    matchedRuleRefs: ['manual:manual-1', 'outreach:session-before-followup'],
    messageContext: {
      groupName: 'Release Chat',
      groupId: 'release-chat',
      sender: 'Morgan',
    },
  });
  assert.deepEqual(stableMatch.matchedRuleRefs, ['manual:manual-1']);
  assert.equal(
    getFirstManualItemFromMatchedRules(stableMatch.watchRules)?.id,
    'manual-1',
  );

  const compatibilityMatch = resolveMatchedWatchRules({
    watchRules: reorderedRuntimeRules,
    matchedRuleIds: [1],
  });
  assert.deepEqual(compatibilityMatch.matchedRuleRefs, ['manual:manual-1']);

  const systemOnlyMatch = resolveMatchedWatchRules({
    watchRules: runtimeRules,
    matchedRuleRefs: ['outreach:session-before-dispatch'],
  });
  assert.equal(
    getFirstManualItemFromMatchedRules(systemOnlyMatch.watchRules),
    undefined,
  );

  const multiScopePromptText = buildRuleText(manualRules[5], true, 4);
  assert.ok(
    multiScopePromptText.includes(
      '在任一群组（Release Chat 或 SDK Updates）中',
    ),
    'LLM prompt should describe multiple groups as OR candidates',
  );
  assert.ok(
    multiScopePromptText.includes('任一发送人（Morgan Lee 或 Alice）'),
    'LLM prompt should describe multiple senders as OR candidates',
  );
  assert.ok(
    multiScopePromptText.includes('[RULE_ID:4]'),
    'LLM prompt should keep stable legacy rule id hints',
  );

  const digestOnlyRule: TopicItemWithAutoReply = {
    id: 'manual-digest-only',
    text: 'Daily summary only',
    expiredAt: 0,
    notifyMethod: 'bot',
    digestConfig: {
      enabled: true,
      frequency: 'daily',
      preferredHour: 9,
    },
  };
  const immediateRule: TopicItemWithAutoReply = {
    id: 'manual-immediate',
    text: 'Immediate alert',
    expiredAt: 0,
    notifyMethod: 'bot',
  };
  const passiveRule: TopicItemWithAutoReply = {
    id: 'manual-passive',
    text: 'Store only',
    expiredAt: 0,
    notifyMethod: '',
  };

  assert.deepEqual(
    getDigestDeliveryItems([digestOnlyRule, immediateRule]).map(
      (item) => item.id,
    ),
    ['manual-digest-only'],
    'digest delivery should include every summary-enabled matched rule',
  );
  assert.equal(
    getImmediateNotificationItem({
      manualItems: [digestOnlyRule, passiveRule, immediateRule],
    })?.id,
    'manual-immediate',
    'digest-only or passive matched rules must not suppress a later immediate notification rule',
  );
  assert.equal(
    getImmediateNotificationItem({
      manualItems: [digestOnlyRule, immediateRule],
      followThreadItem: manualRules[1],
    })?.id,
    'manual-follow-1',
    'follow-thread notification should keep priority over ordinary immediate rules',
  );

  console.log('verify-memory-entry-runtime: ok');
}

main();
