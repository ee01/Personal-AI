import type {
  MemoryRetrievalTier,
  RecallLifecycleMode,
} from '../types/index.js';
import { now } from '../utils/time.js';

export interface LifecycleClassificationInput {
  salienceScore?: number | null;
  effectiveSalience?: number | null;
  retrievalTier?: string | null;
  consolidationLevel?: string | null;
  lastAccessed?: number | null;
  createdAt?: number | null;
  timestamp?: number | null;
  feedbackAction?: 'positive' | 'negative' | 'clear' | string | null;
  feedbackUpdatedAt?: number | null;
  currentTime?: number;
}

export interface LifecycleClassification {
  tier: MemoryRetrievalTier;
  effectiveSalience: number;
  archiveReason?: string;
}

export interface LifecycleDecision extends LifecycleClassification {
  allowed: boolean;
  weight: number;
  reason: string;
}

export const MEMORY_RETRIEVAL_TIERS: MemoryRetrievalTier[] = [
  'core',
  'active',
  'weak',
  'historical',
  'archive_only',
  'forgotten',
];

const POSITIVE_FEEDBACK_ACTIVE_FLOOR_DAYS = 45;
const HISTORICAL_AGE_DAYS = 180;
const NO_METADATA_WEAK_DAYS = 90;
const NO_METADATA_HISTORICAL_DAYS = 365;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeTier(value?: string | null): MemoryRetrievalTier | undefined {
  return MEMORY_RETRIEVAL_TIERS.includes(value as MemoryRetrievalTier)
    ? (value as MemoryRetrievalTier)
    : undefined;
}

function ageDays(input: LifecycleClassificationInput): number | undefined {
  const reference = input.lastAccessed ?? input.timestamp ?? input.createdAt;
  if (reference == null) return undefined;
  return Math.max(0, ((input.currentTime ?? now()) - reference) / 86400);
}

function hasRecentPositiveFeedback(input: LifecycleClassificationInput): boolean {
  if (input.feedbackAction !== 'positive') return false;
  if (input.feedbackUpdatedAt == null) return true;
  return (
    ((input.currentTime ?? now()) - input.feedbackUpdatedAt) / 86400 <=
    POSITIVE_FEEDBACK_ACTIVE_FLOOR_DAYS
  );
}

export function classifyMemoryLifecycle(
  input: LifecycleClassificationInput,
): LifecycleClassification {
  const explicitTier = normalizeTier(input.retrievalTier);
  const level = input.consolidationLevel;
  const currentSalience = clamp01(
    input.effectiveSalience ?? input.salienceScore ?? 0,
  );

  let tier: MemoryRetrievalTier;
  let effectiveSalience = currentSalience;
  let archiveReason: string | undefined;

  if (explicitTier && explicitTier !== 'active') {
    tier = explicitTier;
  } else if (level === 'permanent' || level === 'core') {
    tier = 'core';
    effectiveSalience = Math.max(effectiveSalience, 0.75);
  } else if (level === 'forgotten') {
    tier = 'forgotten';
    archiveReason = 'consolidation_level_forgotten';
  } else if (level === 'archived') {
    tier = 'archive_only';
    archiveReason = 'consolidation_level_archived';
  } else if (
    input.salienceScore == null &&
    input.effectiveSalience == null &&
    !explicitTier
  ) {
    const age = ageDays(input);
    if (age != null && age > NO_METADATA_HISTORICAL_DAYS) {
      tier = 'historical';
      effectiveSalience = 0.12;
    } else if (age != null && age > NO_METADATA_WEAK_DAYS) {
      tier = 'weak';
      effectiveSalience = 0.2;
    } else {
      tier = 'active';
      effectiveSalience = 0.4;
    }
  } else if (currentSalience < 0.05) {
    tier = 'forgotten';
    archiveReason = 'salience_below_forgotten_threshold';
  } else if (currentSalience < 0.15) {
    tier = 'archive_only';
    archiveReason = 'salience_below_archive_threshold';
  } else if (currentSalience < 0.35) {
    const age = ageDays(input);
    tier = age != null && age > HISTORICAL_AGE_DAYS ? 'historical' : 'weak';
  } else {
    tier = explicitTier ?? 'active';
  }

  if (hasRecentPositiveFeedback(input) && tier !== 'forgotten') {
    tier = 'active';
    effectiveSalience = Math.max(effectiveSalience, 0.4);
    archiveReason = undefined;
  }

  return {
    tier,
    effectiveSalience,
    archiveReason,
  };
}

export function decideMemoryLifecycle(
  input: LifecycleClassificationInput,
  mode: RecallLifecycleMode = 'active_default',
): LifecycleDecision {
  const classified = classifyMemoryLifecycle(input);
  const negativeFeedback = input.feedbackAction === 'negative';
  const tier = classified.tier;

  if (
    negativeFeedback &&
    (mode === 'passive_surface' || mode === 'composer_surface')
  ) {
    return {
      ...classified,
      allowed: false,
      weight: 0,
      reason: 'negative_feedback_suppressed',
    };
  }

  const allowedByMode: Record<RecallLifecycleMode, Set<MemoryRetrievalTier>> = {
    active_default: new Set(['core', 'active', 'weak', 'historical']),
    passive_surface: new Set(['core', 'active']),
    composer_surface: new Set(['core', 'active']),
    historical: new Set([
      'core',
      'active',
      'weak',
      'historical',
      'archive_only',
    ]),
    explicit_search: new Set([
      'core',
      'active',
      'weak',
      'historical',
      'archive_only',
    ]),
    audit: new Set([
      'core',
      'active',
      'weak',
      'historical',
      'archive_only',
      'forgotten',
    ]),
  };

  if (!allowedByMode[mode].has(tier)) {
    return {
      ...classified,
      allowed: false,
      weight: 0,
      reason: `${tier}_not_allowed_for_${mode}`,
    };
  }

  const baseWeightByTier: Record<MemoryRetrievalTier, number> = {
    core: 1.15,
    active: 1,
    weak: mode === 'passive_surface' || mode === 'composer_surface' ? 0 : 0.45,
    historical: mode === 'historical' ? 0.55 : 0.25,
    archive_only:
      // A user explicitly tracing when or why something happened needs
      // archive evidence to compete with newer but less specific records.
      mode === 'historical' || mode === 'explicit_search' ? 0.55 : 0,
    forgotten: mode === 'audit' ? 0.05 : 0,
  };

  const feedbackWeight = negativeFeedback ? 0.3 : 1;
  const weight = baseWeightByTier[tier] * feedbackWeight;

  return {
    ...classified,
    allowed: weight > 0,
    weight,
    reason:
      tier === 'core' || tier === 'active'
        ? 'active_lifecycle_match'
        : `${tier}_lifecycle_downgraded`,
  };
}
