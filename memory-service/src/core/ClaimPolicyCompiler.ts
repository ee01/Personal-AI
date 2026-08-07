import type {
  ClaimAttributionSignal,
  ClaimCommitmentState,
  ClaimOwnerKind,
  ClaimPolarity,
  ClaimSpeechMode,
  ClaimTimeBasis,
  ClaimVerificationState,
  MemoryClaimPolicy,
} from '../types/index.js';

/**
 * The smallest claim shape needed to decide whether a derived memory may be
 * promoted or recalled. Keeping this contract free of repository state makes
 * the compiler deterministic and safe to reuse in ingestion, backfills and
 * correction handling.
 */
export interface ClaimPolicyInput {
  owner: { kind: ClaimOwnerKind };
  speechMode: ClaimSpeechMode;
  polarity: ClaimPolarity;
  timeBasis: ClaimTimeBasis;
  verification: ClaimVerificationState;
  commitment: ClaimCommitmentState;
  signals?: readonly ClaimAttributionSignal[];
  normalizedClaim?: string;
  sourceText?: string;
  confidence?: number;
}

const PROFILE_LANGUAGE = [
  // Chinese: identity, preference, habit and personal constraints.
  /(?:^|[，。！？；,!?;\s])我(?:是|更?喜欢|偏好|倾向于?|习惯|通常|一般|总是|从不|讨厌|不喜欢|需要|必须|不能|不愿意)/u,
  /我的(?:偏好|习惯|原则|风格|工作方式|沟通方式|约束)(?:是|为|：|:)/u,
  // English equivalents. Word boundaries deliberately exclude quoted names
  // such as "iPhone" while still matching contractions.
  /\bI\s+(?:am|prefer|like|dislike|hate|usually|generally|always|never|need|must|cannot|can't|do\s+not\s+like|don't\s+like)\b/i,
  /\bmy\s+(?:preference|habit|principle|style|workflow|communication\s+style|constraint)\s+(?:is|are)\b/i,
] as const;

function isProfileLike(input: ClaimPolicyInput): boolean {
  const text = `${input.normalizedClaim ?? ''}\n${input.sourceText ?? ''}`;
  return PROFILE_LANGUAGE.some((pattern) => pattern.test(text));
}

function hasSignal(
  input: ClaimPolicyInput,
  signal: ClaimAttributionSignal,
): boolean {
  return input.signals?.includes(signal) === true;
}

function isUnsafeEpistemicMode(mode: ClaimSpeechMode): boolean {
  return (
    mode === 'question' ||
    mode === 'hypothesis' ||
    mode === 'simulation'
  );
}

/**
 * Compile the irreversible/high-responsibility gates for one attributed claim.
 *
 * Fail-closed invariants:
 * - unknown owners never become profile, truth or action candidates;
 * - quoted/reported/AI/other-person content stays out of those layers;
 * - questions and hypothetical content never become facts or actions;
 * - an action candidate requires an explicitly accepted self commitment;
 * - a completion receipt is trusted only when the connector signal is present.
 */
export function compileMemoryClaimPolicy(
  input: ClaimPolicyInput,
): MemoryClaimPolicy {
  const ownerKind = input.owner.kind;
  const sufficientlyAttributed = (input.confidence ?? 1) >= 0.75;
  const selfOwned = ownerKind === 'self' && sufficientlyAttributed;
  const directSelfStatement =
    selfOwned &&
    (input.speechMode === 'direct_assertion' ||
      input.speechMode === 'correction');
  const contradicted = input.verification === 'contradicted';
  const uncertain = input.polarity === 'uncertain';
  const unsafeMode = isUnsafeEpistemicMode(input.speechMode);
  const counterfactual = input.timeBasis === 'counterfactual';
  const quotedOrReported =
    input.speechMode === 'quote' ||
    input.speechMode === 'reported_speech';

  const connectorVerifiedCompletion =
    sufficientlyAttributed &&
    input.verification === 'verified_completion' &&
    hasSignal(input, 'connector_receipt') &&
    (ownerKind === 'organization_or_source' ||
      ownerKind === 'system_observation');

  const profileCandidate =
    directSelfStatement &&
    !contradicted &&
    !uncertain &&
    input.timeBasis === 'current' &&
    isProfileLike(input);

  const currentTruthCandidate =
    connectorVerifiedCompletion ||
    (directSelfStatement &&
      !contradicted &&
      !uncertain &&
      input.timeBasis === 'current');

  const actionCandidate =
    selfOwned &&
    input.speechMode === 'commitment' &&
    input.commitment === 'accepted' &&
    input.polarity === 'affirmed' &&
    !contradicted;

  let passiveRecall: MemoryClaimPolicy['passiveRecall'];
  if (
    ownerKind === 'unknown' ||
    !sufficientlyAttributed ||
    contradicted ||
    unsafeMode ||
    counterfactual
  ) {
    passiveRecall = 'block';
  } else if (
    connectorVerifiedCompletion ||
    directSelfStatement ||
    actionCandidate
  ) {
    passiveRecall = 'allow';
  } else {
    // AI suggestions, other people's statements, quotes, unaccepted plans and
    // source-only observations can support an explicit answer, but must not
    // silently impersonate the user on passive surfaces.
    passiveRecall = 'background_only';
  }

  // These variables are intentionally part of the guard expression above;
  // retaining the explicit invariant here protects future mode additions from
  // accidentally making quote/report content promotable.
  if (quotedOrReported || unsafeMode) {
    return {
      profileCandidate: false,
      currentTruthCandidate: false,
      actionCandidate: false,
      passiveRecall,
    };
  }

  return {
    profileCandidate,
    currentTruthCandidate,
    actionCandidate,
    passiveRecall,
  };
}

export class ClaimPolicyCompiler {
  compile(input: ClaimPolicyInput): MemoryClaimPolicy {
    return compileMemoryClaimPolicy(input);
  }

  static compile(input: ClaimPolicyInput): MemoryClaimPolicy {
    return compileMemoryClaimPolicy(input);
  }
}
