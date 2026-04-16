import assert from 'node:assert/strict';

import {
  buildRuntimeWatchRules,
  getFirstManualItemFromMatchedRules,
  isManualConcernedItem,
  resolveMatchedWatchRules,
} from '../src/watchRules.ts';
import type { TopicItemWithAutoReply } from '../src/message-reaction/AutoReplyHandler.ts';
import type { OutreachSession } from '../src/services/MemoryServiceClient.ts';

const manualRules: TopicItemWithAutoReply[] = [
  {
    id: 'manual-1',
    text: 'Watch blocker updates',
    expiredAt: 0,
    notifyMethod: 'bot',
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
    id: 'outreach:legacy-system-item',
    text: 'legacy internal rule',
    expiredAt: 0,
    // intentionally invalid legacy contamination case
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
  assert.equal(isManualConcernedItem(manualRules[2]), false);

  const runtimeRules = buildRuntimeWatchRules({
    manualItems: manualRules,
    outreachSessions,
  });

  const ruleRefs = runtimeRules.map((rule) => rule.ruleRef);
  assert.deepEqual(ruleRefs, [
    'manual:manual-1',
    'manual:manual-follow-1',
    'outreach:session-before-dispatch',
    'outreach:session-before-followup',
  ]);

  const reorderedRuntimeRules = buildRuntimeWatchRules({
    manualItems: [manualRules[1], manualRules[0], manualRules[2]],
    outreachSessions: [outreachSessions[1], outreachSessions[0]],
  });
  const stableMatch = resolveMatchedWatchRules({
    watchRules: reorderedRuntimeRules,
    matchedRuleRefs: ['manual:manual-1', 'outreach:session-before-followup'],
  });
  assert.deepEqual(stableMatch.matchedRuleRefs, [
    'manual:manual-1',
    'outreach:session-before-followup',
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
