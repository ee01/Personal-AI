import { describe, expect, it } from 'vitest';

import {
  ClaimSegmenter,
  segmentMemoryClaims,
} from '../core/ClaimSegmenter.js';
import { contentHash } from '../utils/hashing.js';

describe('ClaimSegmenter', () => {
  it('splits a mixed Chinese/English message into exact attributable spans', () => {
    const content =
      '另一位 AI 建议改成 React；Alice 说年底必须上 Angular；我的决定是先保留 Vue，等性能测试；先假设 7 月 1 日上线。';

    const claims = segmentMemoryClaims({
      content,
      sourceMessageId: 'mixed-1',
      sourceType: 'glip',
      metadata: { authorRole: 'user' },
    });

    expect(claims).toHaveLength(4);
    expect(claims.map((claim) => claim.owner.kind)).toEqual([
      'ai_agent',
      'named_person',
      'self',
      'self',
    ]);
    expect(claims.map((claim) => claim.speechMode)).toEqual([
      'suggestion',
      'reported_speech',
      'direct_assertion',
      'hypothesis',
    ]);
    expect(claims[1].owner.displayName).toBe('Alice');
    expect(claims[3]).toMatchObject({
      polarity: 'uncertain',
      timeBasis: 'hypothetical',
    });

    for (const claim of claims) {
      const exactSource = content.slice(
        claim.sourceSpan.start,
        claim.sourceSpan.end,
      );
      expect(claim.sourceMessageId).toBe('mixed-1');
      expect(claim.sourceText).toBe(exactSource);
      expect(claim.sourceSpan.textHash).toBe(contentHash(exactSource));
    }
  });

  it('uses explicit upstream roles while letting in-text attribution override the message author', () => {
    const assistant = ClaimSegmenter.segment({
      content: 'I suggest keeping the current API.',
      sourceType: 'ai_chat',
      sender: 'ChatGPT',
      metadata: { role: 'assistant' },
    })[0];
    const userReportingAlice = ClaimSegmenter.segment({
      content: 'Alice said we must switch to Angular.',
      sourceType: 'glip',
      metadata: { role: 'user' },
    })[0];

    expect(assistant).toMatchObject({
      owner: { kind: 'ai_agent', displayName: 'ChatGPT' },
      speechMode: 'suggestion',
      verification: 'source_only',
    });
    expect(assistant.signals).toEqual([
      'message_role',
      'speaker_label',
      'linguistic_marker',
    ]);
    expect(userReportingAlice).toMatchObject({
      owner: { kind: 'named_person', displayName: 'Alice' },
      speechMode: 'reported_speech',
      verification: 'source_only',
    });
  });

  it('fails closed for role-less AI imports, role conflicts and unattributed quotes', () => {
    const rolelessImport = segmentMemoryClaims({
      content: 'I prefer Vue.',
      sourceType: 'chatgpt',
    })[0];
    const conflictingRole = segmentMemoryClaims({
      content: 'My decision is Vue.',
      sourceType: 'ai_chat',
      metadata: { isSelf: true, role: 'assistant' },
    })[0];
    const quote = segmentMemoryClaims({
      content: '“I prefer Angular.”',
      sourceType: 'glip',
      metadata: { role: 'user' },
    })[0];

    expect(rolelessImport.owner.kind).toBe('unknown');
    expect(rolelessImport.confidence).toBeLessThan(0.5);
    expect(conflictingRole.owner.kind).toBe('unknown');
    expect(conflictingRole.confidence).toBeLessThan(0.5);
    expect(quote).toMatchObject({
      owner: { kind: 'unknown' },
      speechMode: 'quote',
    });
    expect(quote.signals).toContain('quote_boundary');
  });

  it('separates assigned, accepted and merely questioned commitments', () => {
    const assigned = segmentMemoryClaims({
      content: '请 Esone 负责完成迁移清单。',
      sourceType: 'meeting',
      sender: 'Alice',
      metadata: { speakerLabel: 'Alice', authorRole: 'external' },
    })[0];
    const accepted = segmentMemoryClaims({
      content: '好的，我来负责完成迁移清单。',
      sourceType: 'meeting',
      metadata: { speakerLabel: 'Esone', authorRole: 'user' },
    })[0];
    const question = segmentMemoryClaims({
      content: '我来做吗？',
      sourceType: 'meeting',
      metadata: { authorRole: 'user' },
    })[0];

    expect(assigned).toMatchObject({
      owner: { kind: 'named_person', displayName: 'Alice' },
      speechMode: 'commitment',
      commitment: 'assigned',
    });
    expect(accepted).toMatchObject({
      owner: { kind: 'self' },
      speechMode: 'commitment',
      commitment: 'accepted',
      timeBasis: 'future_intent',
    });
    expect(question).toMatchObject({
      owner: { kind: 'self' },
      speechMode: 'question',
      commitment: 'none',
      polarity: 'uncertain',
    });
  });

  it('recognizes correction, intent and simulation without promoting them to completion', () => {
    const [correction, intent, simulation] = segmentMemoryClaims({
      content:
        '更正：我的决定是保留 Vue。I plan to test it tomorrow. 模拟 7 月 1 日已经上线。',
      sourceType: 'manual',
      metadata: { ownerAuthored: true },
    });

    expect(correction.speechMode).toBe('correction');
    expect(intent).toMatchObject({
      speechMode: 'intent_or_plan',
      commitment: 'proposed',
      timeBasis: 'future_intent',
    });
    expect(simulation).toMatchObject({
      speechMode: 'simulation',
      polarity: 'uncertain',
      timeBasis: 'hypothetical',
    });
    expect([correction, intent, simulation].map((claim) => claim.verification)).toEqual([
      'unverified',
      'unverified',
      'unverified',
    ]);
  });

  it('emits verified_completion only for an explicit connector receipt', () => {
    const proseOnly = segmentMemoryClaims({
      content: 'Jira ticket is done.',
      sourceType: 'jira',
    })[0];
    const receipt = segmentMemoryClaims({
      content: 'Jira ticket is done.',
      sourceType: 'jira',
      metadata: { connectorReceipt: true },
    })[0];

    expect(proseOnly.verification).toBe('source_only');
    expect(proseOnly.signals).not.toContain('connector_receipt');
    expect(receipt).toMatchObject({
      owner: { kind: 'organization_or_source' },
      verification: 'verified_completion',
      confidence: 1,
    });
    expect(receipt.signals).toContain('connector_receipt');
  });
});
