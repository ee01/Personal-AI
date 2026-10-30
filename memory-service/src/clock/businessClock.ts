/**
 * Injectable business clock for virtual-time benchmark replay.
 * When no override is active, falls back to wall clock (seconds).
 * Network timeouts and performance timing should keep using Date.now() directly.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const businessTimeSec = new AsyncLocalStorage<number>();

export function getBusinessTimeSec(): number {
  const injected = businessTimeSec.getStore();
  if (injected !== undefined) return injected;
  return Math.floor(Date.now() / 1000);
}

export function getBusinessTimeMs(): number {
  return getBusinessTimeSec() * 1000;
}

export function runWithBusinessClockAt<T>(atSec: number, fn: () => T): T {
  return businessTimeSec.run(atSec, fn);
}

export function runWithBusinessClockAtAsync<T>(
  atSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  return businessTimeSec.run(atSec, fn);
}

/** Test-only: run fn with injected business time (same as production ALS path). */
export async function withBusinessClock<T>(
  atSec: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  return runWithBusinessClockAtAsync(atSec, async () => fn());
}
