/**
 * UsageRecorder — thin, fail-safe helper that records a single LLM call's token
 * usage into the AnalyticsStore, reading attribution from the current async
 * usage context when not explicitly provided.
 *
 * Recording is always best-effort: any error is swallowed so analytics never
 * breaks the LLM code path.
 */

import { getAnalyticsStore, type UsageSide } from './AnalyticsStore.js';
import { getUsageContext } from './usageContext.js';
import { normalizeCapability } from './capabilityMap.js';

export interface RecordLlmUsageParams {
  side: UsageSide;
  model: string | null | undefined;
  promptTokens: number;
  completionTokens: number;
  status?: 'ok' | 'error' | string | null;
  errorKind?: string | null;
  /** Actual provider that served or failed the call (set during fallback). */
  provider?: string | null;
  /** Overrides for context fields (fall back to the current async context). */
  userId?: string | null;
  capability?: string | null;
  feature?: string | null;
  route?: string | null;
  ts?: number;
  requestId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Record one LLM call's usage. Missing attribution fields are filled from the
 * current async usage context. No-op when the analytics store is unavailable.
 */
export function recordLlmUsage(params: RecordLlmUsageParams): void {
  try {
    const store = getAnalyticsStore();
    if (!store) return;

    const ctx = getUsageContext();
    const capability = normalizeCapability(
      params.capability ?? ctx?.capability ?? null,
    );

    store.recordUsageEvent({
      ts: params.ts,
      userId: params.userId ?? ctx?.userId ?? 'unknown',
      side: params.side,
      capability,
      feature: params.feature ?? ctx?.feature ?? null,
      route: params.route ?? ctx?.route ?? null,
      model: params.model ?? null,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      status: params.status === 'error' ? 'error' : 'ok',
      errorKind: params.errorKind ?? null,
      requestId: params.requestId ?? null,
      meta: (() => {
        const meta = {
          ...(params.meta ?? {}),
          ...(params.provider ? { provider: params.provider } : {}),
        };
        return Object.keys(meta).length > 0 ? meta : null;
      })(),
    });
  } catch {
    // Best-effort: never surface analytics errors into the caller.
  }
}
