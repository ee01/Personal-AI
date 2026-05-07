import assert from 'node:assert/strict';

import {
  getMatchedAutoReplyItem,
  type TopicItemWithAutoReply,
} from '../src/message-reaction/AutoReplyHandler.ts';
import {
  buildRuntimeWatchRules,
  filterWatchRulesForMessageContext,
  getFirstManualItemFromMatchedRules,
  isManualConcernedItem,
  resolveMatchedWatchRules,
} from '../src/watchRules.ts';
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
    'outreach:session-before-dispatch',
    'outreach:session-before-followup',
  ]);

  const releaseRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'Release Chat',
    groupId: 'release-chat',
    sender: 'Morgan',
  });
  assert.deepEqual(releaseRules.map((rule) => rule.ruleRef), [
    'manual:manual-1',
    'manual:manual-follow-1',
  ]);

  const sdkRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'sdk-updates',
    groupId: 'sdk-updates',
    sender: 'James Lee',
  });
  assert.deepEqual(sdkRules.map((rule) => rule.ruleRef), [
    'manual:manual-follow-1',
    'outreach:session-before-followup',
  ]);

  const aiResearchRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'AI Research',
    groupId: 'ai-research',
    sender: 'Priya',
  });
  assert.ok(
    aiResearchRules.some((rule) => rule.ruleRef === 'manual:manual-ai-short-scope'),
    'short scope token should match a full group token',
  );

  const dailyStandupRules = filterWatchRulesForMessageContext(runtimeRules, {
    groupName: 'Daily Standup',
    groupId: 'daily-standup',
    sender: 'Priya',
  });
  assert.equal(
    dailyStandupRules.some((rule) => rule.ruleRef === 'manual:manual-ai-short-scope'),
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
  assert.deepEqual(stableMatch.matchedRuleRefs, [
    'manual:manual-1',
  ]);
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

  console.log('verify-memory-entry-runtime: ok');
}

main();
