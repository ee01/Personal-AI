/**
 * Async usage context propagated across the request lifecycle and background
 * scheduler tasks, so LLM calls can be attributed to a user + capability.
 *
 * - HTTP requests: a Fastify onRequest hook calls `enterUsageContext()` after
 *   auth resolves `request.userId` (see server.ts).
 * - Background tasks: wrap work in `runWithUsageContext(ctx, fn)`.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import type { CapabilityKey } from './capabilityMap.js';
import type { UsageSide } from './AnalyticsStore.js';

export interface UsageContext {
  userId?: string;
  capability?: CapabilityKey;
  feature?: string;
  side?: UsageSide;
  route?: string;
}

const storage = new AsyncLocalStorage<UsageContext>();

/** Get the current usage context, if any. */
export function getUsageContext(): UsageContext | undefined {
  return storage.getStore();
}

/**
 * Enter a usage context for the remainder of the current async execution.
 * Used by the Fastify onRequest hook (persists into the route handler).
 */
export function enterUsageContext(ctx: UsageContext): void {
  storage.enterWith(ctx);
}

/** Run `fn` within a usage context (scoped). Used by background tasks. */
export function runWithUsageContext<T>(ctx: UsageContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
