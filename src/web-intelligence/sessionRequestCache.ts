import { stableWebpageHash } from './passiveWebpageAnalysis';

export interface SessionRequestCacheEntry<T> {
  expiresAt: number;
  value: T;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

export function buildSessionRequestCacheKey(
  namespace: string,
  value: unknown,
): string {
  return `${namespace}:${stableWebpageHash(stableSerialize(value))}`;
}

export class SessionRequestCache<T> {
  private readonly entries = new Map<string, SessionRequestCacheEntry<T>>();

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries: number,
  ) {}

  hydrate(raw: unknown, now = Date.now()): void {
    if (!raw || typeof raw !== 'object') return;
    for (const [key, candidate] of Object.entries(
      raw as Record<string, SessionRequestCacheEntry<T>>,
    )) {
      if (
        !candidate ||
        typeof candidate.expiresAt !== 'number' ||
        candidate.expiresAt <= now ||
        candidate.value === undefined
      ) {
        continue;
      }
      this.entries.set(key, candidate);
    }
    this.prune(now);
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(
    key: string,
    value: T,
    options: { now?: number; ttlMs?: number } = {},
  ): void {
    const now = options.now ?? Date.now();
    this.entries.delete(key);
    this.entries.set(key, {
      expiresAt: now + (options.ttlMs ?? this.defaultTtlMs),
      value,
    });
    this.prune(now);
  }

  snapshot(now = Date.now()): Record<string, SessionRequestCacheEntry<T>> {
    this.prune(now);
    return Object.fromEntries(this.entries.entries());
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      this.entries.delete(oldestKey);
    }
  }
}
