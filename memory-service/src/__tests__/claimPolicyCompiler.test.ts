import { describe, expect, it } from 'vitest';

import {
  ClaimPolicyCompiler,
  compileMemoryClaimPolicy,
  type ClaimPolicyInput,
} from '../core/ClaimPolicyCompiler.js';

function claim(
  overrides: Partial<ClaimPolicyInput> = {},
): ClaimPolicyInput {
  return {
    owner: { kind: 'self' },
    speechMode: 'direct_assertion',
    polarity: 'affirmed',
    timeBasis: 'current',
    verification: 'unverified',
    commitment: 'none',
    signals: ['message_role'],
    normalizedClaim: '我的偏好是使用 Vue。',
    ...overrides,
  };
}

describe('ClaimPolicyCompiler', () => {
  it('allows a clear self preference into profile/current truth without making an action', () => {
    expect(compileMemoryClaimPolicy(claim())).toEqual({
      profileCandidate: true,
      currentTruthCandidate: true,
      actionCandidate: false,
      passiveRecall: 'allow',
    });

    expect(
      ClaimPolicyCompiler.compile(
        claim({ normalizedClaim: '我的决定是保留 Vue。' }),
      ),
    ).toEqual({
      profileCandidate: false,
      currentTruthCandidate: true,
      actionCandidate: false,
      passiveRecall: 'allow',
    });
  });

  it.each([
    ['AI suggestion', claim({ owner: { kind: 'ai_agent' }, speechMode: 'suggestion' })],
    [
      'reported speech',
      claim({ owner: { kind: 'named_person' }, speechMode: 'reported_speech' }),
    ],
    ['quote', claim({ speechMode: 'quote' })],
    [
      'hypothesis',
      claim({
        speechMode: 'hypothesis',
        polarity: 'uncertain',
        timeBasis: 'hypothetical',
      }),
    ],
    [
      'question',
      claim({ speechMode: 'question', polarity: 'uncertain', timeBasis: 'unknown' }),
    ],
  ])('blocks all high-responsibility writes for %s', (_label, input) => {
    const policy = compileMemoryClaimPolicy(input);
    expect(policy.profileCandidate).toBe(false);
    expect(policy.currentTruthCandidate).toBe(false);
    expect(policy.actionCandidate).toBe(false);
  });

  it('uses background_only for external context and block for hypothetical/unknown content', () => {
    expect(
      compileMemoryClaimPolicy(
        claim({ owner: { kind: 'ai_agent' }, speechMode: 'suggestion' }),
      ).passiveRecall,
    ).toBe('background_only');
    expect(
      compileMemoryClaimPolicy(
        claim({ owner: { kind: 'named_person' }, speechMode: 'reported_speech' }),
      ).passiveRecall,
    ).toBe('background_only');
    expect(
      compileMemoryClaimPolicy(
        claim({ owner: { kind: 'unknown' } }),
      ).passiveRecall,
    ).toBe('block');
    expect(
      compileMemoryClaimPolicy(
        claim({
          speechMode: 'simulation',
          polarity: 'uncertain',
          timeBasis: 'hypothetical',
        }),
      ).passiveRecall,
    ).toBe('block');
  });

  it('creates an action candidate only for an accepted, affirmed self commitment', () => {
    const accepted = claim({
      speechMode: 'commitment',
      commitment: 'accepted',
      timeBasis: 'future_intent',
      normalizedClaim: '我来负责完成迁移清单。',
    });
    expect(compileMemoryClaimPolicy(accepted)).toMatchObject({
      actionCandidate: true,
      profileCandidate: false,
      currentTruthCandidate: false,
      passiveRecall: 'allow',
    });

    for (const denied of [
      claim({
        speechMode: 'commitment',
        commitment: 'assigned',
        timeBasis: 'future_intent',
      }),
      claim({
        speechMode: 'commitment',
        commitment: 'proposed',
        timeBasis: 'future_intent',
      }),
      claim({
        owner: { kind: 'named_person' },
        speechMode: 'commitment',
        commitment: 'accepted',
        timeBasis: 'future_intent',
      }),
      claim({
        speechMode: 'commitment',
        commitment: 'accepted',
        polarity: 'negated',
        timeBasis: 'future_intent',
      }),
    ]) {
      expect(compileMemoryClaimPolicy(denied).actionCandidate).toBe(false);
    }
  });

  it('trusts a completion as current truth only with an explicit connector signal', () => {
    const receipt = claim({
      owner: { kind: 'organization_or_source' },
      speechMode: 'direct_assertion',
      timeBasis: 'as_of_source_time',
      verification: 'verified_completion',
      signals: ['connector_receipt'],
      normalizedClaim: 'Jira ticket completed.',
    });
    expect(compileMemoryClaimPolicy(receipt)).toEqual({
      profileCandidate: false,
      currentTruthCandidate: true,
      actionCandidate: false,
      passiveRecall: 'allow',
    });

    expect(
      compileMemoryClaimPolicy({ ...receipt, signals: [] }),
    ).toMatchObject({
      profileCandidate: false,
      currentTruthCandidate: false,
      actionCandidate: false,
      passiveRecall: 'background_only',
    });
  });

  it('keeps negated preferences eligible but rejects uncertain or contradicted ones', () => {
    expect(
      compileMemoryClaimPolicy(
        claim({
          polarity: 'negated',
          normalizedClaim: '我不喜欢 React。',
        }),
      ).profileCandidate,
    ).toBe(true);
    expect(
      compileMemoryClaimPolicy(
        claim({ polarity: 'uncertain', normalizedClaim: '我可能更喜欢 Vue。' }),
      ).profileCandidate,
    ).toBe(false);
    expect(
      compileMemoryClaimPolicy(
        claim({ verification: 'contradicted' }),
      ),
    ).toMatchObject({
      profileCandidate: false,
      currentTruthCandidate: false,
      actionCandidate: false,
      passiveRecall: 'block',
    });
  });
});
