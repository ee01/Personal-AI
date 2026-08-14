export interface WebpageAnalysisFailureState {
  attempts: number;
  lastFailedAt: number;
  retryAfter: number;
  errorKind: string;
}

export interface WebpageAnalysisFailureBackoffOptions {
  delaysMs?: number[];
  retentionMs?: number;
  maxEntries?: number;
}

const DEFAULT_DELAYS_MS = [5 * 60_000, 10 * 60_000, 15 * 60_000];
const DEFAULT_RETENTION_MS = 6 * 60 * 60_000;

function isFailureState(value: unknown): value is WebpageAnalysisFailureState {
  const item = value as Partial<WebpageAnalysisFailureState> | null;
  return Boolean(
    item &&
      Number.isFinite(item.attempts) &&
      Number(item.attempts) > 0 &&
      Number.isFinite(item.lastFailedAt) &&
      Number.isFinite(item.retryAfter) &&
      typeof item.errorKind === 'string',
  );
}

export class WebpageAnalysisFailureBackoff {
  private readonly delaysMs: number[];
  private readonly retentionMs: number;
  private readonly maxEntries: number;
  private readonly states = new Map<string, WebpageAnalysisFailureState>();

  constructor(options: WebpageAnalysisFailureBackoffOptions = {}) {
    this.delaysMs = (options.delaysMs || DEFAULT_DELAYS_MS)
      .map((value) => Math.max(1, Math.floor(value)))
      .filter(Number.isFinite);
    if (this.delaysMs.length === 0) {
      this.delaysMs = [...DEFAULT_DELAYS_MS];
    }
    this.retentionMs = Math.max(1, options.retentionMs || DEFAULT_RETENTION_MS);
    this.maxEntries = Math.max(1, options.maxEntries || 80);
  }

  hydrate(raw: unknown, now = Date.now()): void {
    this.states.clear();
    if (!raw || typeof raw !== 'object') return;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!key || !isFailureState(value)) continue;
      if (now - value.lastFailedAt >= this.retentionMs) continue;
      this.states.set(key, { ...value });
    }
    this.enforceLimit();
  }

  getCooldown(
    key: string,
    now = Date.now(),
  ): WebpageAnalysisFailureState | undefined {
    const state = this.states.get(key);
    if (!state) return undefined;
    if (now - state.lastFailedAt >= this.retentionMs) {
      this.states.delete(key);
      return undefined;
    }
    return state.retryAfter > now ? { ...state } : undefined;
  }

  recordFailure(
    key: string,
    errorKind: string,
    now = Date.now(),
  ): WebpageAnalysisFailureState {
    const current = this.states.get(key);
    const attempts =
      current && now - current.lastFailedAt < this.retentionMs
        ? current.attempts + 1
        : 1;
    const delay =
      this.delaysMs[Math.min(attempts - 1, this.delaysMs.length - 1)];
    const state = {
      attempts,
      lastFailedAt: now,
      retryAfter: now + delay,
      errorKind: String(errorKind || 'unknown'),
    };
    this.states.delete(key);
    this.states.set(key, state);
    this.enforceLimit();
    return { ...state };
  }

  clear(key: string): boolean {
    return this.states.delete(key);
  }

  snapshot(now = Date.now()): Record<string, WebpageAnalysisFailureState> {
    const result: Record<string, WebpageAnalysisFailureState> = {};
    for (const [key, state] of Array.from(this.states.entries())) {
      if (now - state.lastFailedAt >= this.retentionMs) {
        this.states.delete(key);
        continue;
      }
      result[key] = { ...state };
    }
    return result;
  }

  private enforceLimit(): void {
    while (this.states.size > this.maxEntries) {
      const oldestKey = this.states.keys().next().value;
      if (typeof oldestKey !== 'string') return;
      this.states.delete(oldestKey);
    }
  }
}

export function classifyWebpageAnalysisFailure(error: unknown): string {
  const status = Number((error as { status?: unknown } | null)?.status || 0);
  const message = String(
    (error as { message?: unknown } | null)?.message || error || '',
  ).toLowerCase();
  if (status === 401 || status === 403) return 'auth';
  if (status === 429 || message.includes('rate limit')) return 'rate_limit';
  if (status >= 500) return 'server';
  if (message.includes('timeout') || message.includes('aborted')) return 'timeout';
  if (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network')
  ) {
    return 'network';
  }
  return status >= 400 ? 'http' : 'unknown';
}
