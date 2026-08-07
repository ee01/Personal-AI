import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUserProfileViewModel } from '../userProfileViewModel.ts';

function profileItem(overrides: Record<string, unknown>) {
  return {
    id: 'profile-item',
    itemType: 'preference',
    itemKey: 'writing_style.review',
    itemValue: '先给结论，再给 evidence',
    evidenceRefs: [{ messageId: 'message-1', ts: 1_785_000_000 }],
    sourceKind: 'inferred',
    confidence: 0.9,
    userConfirmed: false,
    status: 'pending_confirm',
    salienceScore: 0.8,
    mentionCount: 1,
    lastSeen: 1_785_000_000,
    ...overrides,
  };
}

test('profile evidence audit remains silent until attribution changes use', () => {
  const ordinary = buildUserProfileViewModel({
    items: [profileItem({})],
    includeRetracted: true,
  }).profile.allItems[0];
  assert.equal(ordinary.claimAttributionReceipt, null);

  const corrected = buildUserProfileViewModel({
    items: [
      profileItem({
        status: 'retracted',
        attributionReceipt: {
          status: 'corrected',
          visibility: 'review',
          summary: '未使用 1 条',
          boundary: '只影响 Personal AI 如何使用派生记忆，不修改原始消息。',
          used: [],
          backgroundOnly: [],
          blocked: [
            {
              kind: 'unknown:reported_speech',
              label: '归属未确认 · 转述',
              count: 1,
            },
          ],
          claims: [
            {
              claimId: 'claim-1',
              sourceMessageId: 'message-1',
              revision: 2,
              excerpt: '我的偏好是先给结论。',
              ownerKind: 'unknown',
              ownerLabel: '归属未确认',
              speechMode: 'reported_speech',
              verification: 'unverified',
              commitment: 'none',
              effect: 'blocked',
              displayLabel: '归属未确认 · 转述',
              consequence: '本轮不使用，也不会沉淀为你的事实或承诺',
              correctionAllowed: true,
              corrected: true,
            },
          ],
          affectedHighResponsibility: true,
          correctedCount: 1,
        },
      }),
    ],
    includeRetracted: true,
  }).profile.allItems[0];

  assert.equal(corrected.claimAttributionReceipt?.title, '归属已纠正');
  assert.equal(corrected.claimAttributionReceipt?.summary, '未使用 1 条');
  assert.match(
    corrected.claimAttributionReceipt?.ariaLabel ?? '',
    /不修改原始消息/,
  );
});
