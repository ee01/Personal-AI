import { describe, expect, it } from 'vitest';

import {
  buildPriorReceipt,
  hasNonSelfTopicAnchor,
  qualifiesAsTopicEvidence,
  selectPersonalPriors,
} from '../core/composerEvidenceSlots.js';
import type { ComposerAssistEvidence } from '../types/index.js';

const identity = {
  names: ['esone', 'qiu', 'esone qiu'],
  stopwords: new Set(['esone', 'qiu', 'esone qiu']),
};

function evidence(
  partial: Partial<ComposerAssistEvidence> & { id: string; snippet: string },
): ComposerAssistEvidence {
  return {
    type: 'chunk',
    ...partial,
  };
}

describe('qualifiesAsTopicEvidence', () => {
  it('rejects a rehearsal whose only people anchor is the owner', () => {
    const item = evidence({
      id: 'r1',
      type: 'rehearsal',
      snippet: 'Remember to follow up',
      evidenceRole: 'rehearsal_cue',
      matchedAnchors: { people: ['Esone Qiu'] },
    });
    expect(hasNonSelfTopicAnchor(item, identity)).toBe(false);
    expect(qualifiesAsTopicEvidence(item, identity)).toBe(false);
  });

  it('accepts an owner-authored memory anchored on a project', () => {
    const item = evidence({
      id: 'c1',
      snippet: 'NC Switcher one-click install is owned by backend.',
      matchedAnchors: { people: ['Esone Qiu'], projects: ['NC Switcher'] },
    });
    expect(qualifiesAsTopicEvidence(item, identity)).toBe(true);
  });

  it('accepts a rehearsal anchored on another person and a group', () => {
    const item = evidence({
      id: 'r2',
      type: 'rehearsal',
      snippet: 'Ask Colin about the review owner.',
      evidenceRole: 'rehearsal_cue',
      matchedAnchors: { people: ['Colin Liu'], source: ['group:colin-group'] },
    });
    expect(qualifiesAsTopicEvidence(item, identity)).toBe(true);
  });
});

describe('selectPersonalPriors', () => {
  it('does not put writing-style memories in the B slot', () => {
    const item = evidence({
      id: 'style-1',
      snippet:
        'When talking to my manager I usually keep Glip replies short and hedge commitments.',
      matchedAnchors: { people: ['Esone Qiu'] },
    });
    expect(qualifiesAsTopicEvidence(item, identity)).toBe(false);
    const priors = selectPersonalPriors(
      [item],
      new Set(),
      identity,
      {
        audienceType: 'manager',
        scene: 'thread_reply',
        speechAct: 'reply',
      },
    );
    expect(priors).toHaveLength(0);
  });

  it('keeps a decision-tendency memory in the B slot', () => {
    const item = evidence({
      id: 'decision-1',
      snippet: 'I usually refuse same-week scope additions from this manager.',
      reasonType: 'prior_decision',
      matchedAnchors: { people: ['Esone Qiu'] },
    });
    expect(qualifiesAsTopicEvidence(item, identity)).toBe(false);
    const priors = selectPersonalPriors(
      [item],
      new Set(),
      identity,
      {
        audienceType: 'manager',
        scene: 'thread_reply',
        speechAct: 'refuse',
      },
    );
    expect(priors).toHaveLength(1);
    expect(priors[0].id).toBe('decision-1');
    expect(priors[0].kind).toBe('decision_tendency');
  });

  it('marks decision priors as stance suggestions when the current ask invites a decision', () => {
    const receipt = buildPriorReceipt(
      [
        {
          id: 'decision-1',
          kind: 'decision_tendency',
          summary: 'I usually refuse same-week scope additions.',
        },
      ],
      'stance_suggestion',
    );
    expect(receipt?.constraint).toBe('stance_suggestion');
    expect(receipt?.summary).toMatch(/建议/);
  });
});
