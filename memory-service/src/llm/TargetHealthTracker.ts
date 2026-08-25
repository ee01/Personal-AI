import type { LLMErrorKind } from './llmErrors.js';
import type { ResolvedLLMTarget } from './LLMTarget.js';

export interface TargetHealthSnapshot {
  id: string;
  healthy: boolean;
  cooldownUntil: number | null;
  consecutiveFailures: number;
}

interface TargetHealthState {
  consecutiveFailures: number;
  cooldownUntil: number;
}

const AUTH_COOLDOWN_MULTIPLIER = 10;

export class TargetHealthTracker {
  private readonly states = new Map<string, TargetHealthState>();

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
    private readonly enabled: boolean,
  ) {}

  recordSuccess(targetId: string): void {
    this.states.delete(targetId);
  }

  recordFailure(targetId: string, kind: LLMErrorKind, now = Date.now()): void {
    if (!this.enabled) return;
    const current = this.states.get(targetId) ?? {
      consecutiveFailures: 0,
      cooldownUntil: 0,
    };
    current.consecutiveFailures += 1;
    const thresholdMet =
      kind === 'auth' || current.consecutiveFailures >= this.failureThreshold;
    if (thresholdMet) {
      const duration =
        kind === 'auth'
          ? this.cooldownMs * AUTH_COOLDOWN_MULTIPLIER
          : this.cooldownMs;
      current.cooldownUntil = now + Math.max(0, duration);
    }
    this.states.set(targetId, current);
  }

  isInCooldown(targetId: string, now = Date.now()): boolean {
    if (!this.enabled) return false;
    const state = this.states.get(targetId);
    if (!state || state.cooldownUntil <= now) return false;
    return true;
  }

  /**
   * Cooldown targets go last. If every target is cooling down, keep original order.
   */
  orderTargets(
    targets: ResolvedLLMTarget[],
    now = Date.now(),
  ): ResolvedLLMTarget[] {
    if (!this.enabled || targets.length <= 1) return targets;
    const healthy: ResolvedLLMTarget[] = [];
    const cooling: ResolvedLLMTarget[] = [];
    for (const target of targets) {
      if (this.isInCooldown(target.id, now)) cooling.push(target);
      else healthy.push(target);
    }
    if (healthy.length === 0) return targets;
    return [...healthy, ...cooling];
  }

  snapshot(targets: ResolvedLLMTarget[], now = Date.now()): TargetHealthSnapshot[] {
    return targets.map((target) => {
      const state = this.states.get(target.id);
      const cooldownUntil =
        state && state.cooldownUntil > now ? state.cooldownUntil : null;
      return {
        id: target.id,
        healthy: cooldownUntil === null,
        cooldownUntil,
        consecutiveFailures: state?.consecutiveFailures ?? 0,
      };
    });
  }
}
