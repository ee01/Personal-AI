import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaimAttributionCompactPresentation,
  buildClaimAttributionCompactPresentationFromItems,
} from '../claimAttributionPresentation.ts';
import type {
  ClaimAttributionReceipt,
  ClaimAttributionReceiptItem,
} from '../services/MemoryServiceClient.ts';

function claim(
  overrides: Partial<ClaimAttributionReceiptItem> = {},
): ClaimAttributionReceiptItem {
  return {
    claimId: 'claim-1',
    sourceMessageId: 'message-1',
    revision: 1,
    excerpt: '我的偏好是先给结论。',
    ownerKind: 'self',
    ownerLabel: '你',
    speechMode: 'direct_assertion',
    verification: 'unverified',
    commitment: 'none',
    effect: 'used',
    displayLabel: '你 · 明确表达',
    consequence: '可作为本轮直接证据',
    correctionAllowed: true,
    corrected: false,
    ...overrides,
  };
}

test('ordinary self evidence remains completely silent', () => {
  assert.equal(
    buildClaimAttributionCompactPresentationFromItems([claim()]),
    null,
  );
});

test('mixed evidence produces one compact consequence receipt', () => {
  const presentation = buildClaimAttributionCompactPresentationFromItems([
    claim(),
    claim({
      claimId: 'claim-ai',
      ownerKind: 'ai_agent',
      ownerLabel: 'AI',
      speechMode: 'suggestion',
      effect: 'background_only',
      displayLabel: 'AI · 建议',
      consequence: '仅作背景，不代表你的立场',
    }),
    claim({
      claimId: 'claim-hypothesis',
      speechMode: 'hypothesis',
      effect: 'blocked',
      displayLabel: '你 · 假设',
      consequence: '本轮不使用，也不会沉淀为你的事实或承诺',
    }),
  ]);

  assert.ok(presentation);
  assert.equal(presentation.title, '已按归属限制证据');
  assert.equal(presentation.summary, '采用 1 条；仅作背景 1 条；未使用 1 条');
  assert.equal(presentation.changedCount, 2);
  assert.match(presentation.ariaLabel, /不修改原始消息/);
});

test('corrected receipt keeps the service summary and review boundary', () => {
  const receipt: ClaimAttributionReceipt = {
    status: 'corrected',
    visibility: 'review',
    summary: '未使用 1 条',
    boundary: '只影响派生记忆，不修改原消息。',
    used: [],
    backgroundOnly: [],
    blocked: [{ kind: 'unknown:reported_speech', label: '归属未确认 · 转述', count: 1 }],
    claims: [
      claim({
        ownerKind: 'unknown',
        ownerLabel: '归属未确认',
        speechMode: 'reported_speech',
        effect: 'blocked',
        displayLabel: '归属未确认 · 转述',
        consequence: '本轮不使用，也不会沉淀为你的事实或承诺',
        corrected: true,
        revision: 2,
      }),
    ],
    affectedHighResponsibility: true,
    correctedCount: 1,
  };

  const presentation = buildClaimAttributionCompactPresentation(receipt);
  assert.ok(presentation);
  assert.equal(presentation.title, '归属已纠正');
  assert.equal(presentation.tone, 'corrected');
  assert.equal(presentation.summary, '未使用 1 条');
  assert.equal(presentation.boundary, '只影响派生记忆，不修改原消息。');
});
