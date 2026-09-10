/**
 * P3 ConsolidationPhases (plan §11.8): the consolidation whitelist drives
 * which background phases are active. Each phase must pass its gate before
 * the next one can be enabled (§11.8: "后一项必须等待前一项过门").
 *
 * A: deterministic decay, evidence-key dedup, independent-source reinforcement
 * B: duplicate/refine/correct proposals (shadow diff first)
 * C: low-authority insight/brief with expiry (D1 in plan numbering)
 * D: profile proposals; durable/sensitive slots stay pending confirmation (D2)
 * E: association edges shadow; must not cross scope or change current truth
 *
 * The exposure/outcome logging is always on (no whitelist gate) so the
 * learned-ranker shadow has data even before E is ready.
 */

export type ConsolidationPhase = 'A' | 'B' | 'C' | 'D' | 'E';

export function isConsolidationPhaseEnabled(phase: ConsolidationPhase): boolean {
  const raw = process.env.MEMORY_CONSOLIDATION_V3?.trim().toUpperCase();
  if (!raw) return false;
  const phases = raw.split(',').map((s) => s.trim());
  return phases.includes(phase);
}

/**
 * P3 profile promotion gate (plan §6.6): a profile slot can be auto-promoted
 * to active only when it is NOT durable/sensitive. Durable identity and
 * long-term behavioral conclusions require user confirmation.
 */
export type ProfileSlotSensitivity = 'normal' | 'durable' | 'sensitive';

export function canAutoPromoteProfile(slot: {
  sensitivity: ProfileSlotSensitivity;
  independentSourceCount: number;
}): boolean {
  // Durable identity and sensitive slots always need confirmation (§6.6).
  if (slot.sensitivity === 'durable' || slot.sensitivity === 'sensitive') {
    return false;
  }
  // Normal slots: at least 2 independent provenance families (§6.6 inductive).
  return slot.independentSourceCount >= 2;
}

/**
 * P3 exposure semantics (plan §7.8): shown/opened is NOT a success review.
 * Only independent evidence, explicit confirmation, correction, and
 * reliable task outcomes affect lifecycle. FSRS-lite update rule.
 */
export interface ExposureRecord {
  requestId: string;
  unitId: string;
  surface: string;
  rank: number;
  shown: boolean;
  quieted: boolean;
  noResult: boolean;
}

export interface OutcomeRecord {
  unitId: string;
  outcomeType:
    | 'opened'
    | 'dismissed'
    | 'adopted'
    | 'edited_after_adoption'
    | 'user_confirmed'
    | 'user_corrected'
    | 'user_rejected'
    | 'downstream_task_success'
    | 'downstream_task_failure';
}

export type LifecycleImpact =
  | 'none' // shown/opened: pure exposure, no state change
  | 'utility_bump' // adopted/task_success: accessibility boost only
  | 'confirmation' // user_confirmed: evidence-grade confirmation
  | 'correction' // user_corrected/rejected: triggers truth maintenance
  | 'decay'; // dismissed (repeated): accessibility decay

export function classifyOutcomeImpact(outcome: OutcomeRecord): LifecycleImpact {
  // I9: exposure ≠ verification. shown/opened never change confidence.
  if (outcome.outcomeType === 'opened' || outcome.outcomeType === 'dismissed') {
    return outcome.outcomeType === 'dismissed' ? 'decay' : 'none';
  }
  // Task outcomes update utility/accessibility only (§7.8).
  if (
    outcome.outcomeType === 'adopted' ||
    outcome.outcomeType === 'downstream_task_success'
  ) {
    return 'utility_bump';
  }
  // Explicit user confirmation is the only evidence-grade reinforcement (§5.6).
  if (outcome.outcomeType === 'user_confirmed') {
    return 'confirmation';
  }
  // Correction/rejection goes to TruthMaintainer as dispute/correction (§8.5).
  if (
    outcome.outcomeType === 'user_corrected' ||
    outcome.outcomeType === 'user_rejected' ||
    outcome.outcomeType === 'downstream_task_failure'
  ) {
    return 'correction';
  }
  return 'none';
}

/**
 * P3 FSRS-lite: retrievability/stability decay from valid review signals only.
 * Plan §8.4: "Retrieval, 展示, 引用和排名本身只是 exposure, 不是成功复习."
 */
export function computeStability(
  currentStability: number,
  impact: LifecycleImpact,
): number {
  const BASE = 1.0;
  const MAX = 10.0;
  switch (impact) {
    case 'confirmation':
      return Math.min(MAX, currentStability * 1.8);
    case 'utility_bump':
      return Math.min(MAX, currentStability * 1.15);
    case 'correction':
      return currentStability * 0.7;
    case 'decay':
      return currentStability * 0.8;
    case 'none':
      return currentStability;
    default:
      return currentStability || BASE;
  }
}
