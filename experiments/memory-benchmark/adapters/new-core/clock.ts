/** Injectable virtual business clock (epoch ms). Monotonic uses performance.now(). */
let businessNowMs: number | null = null;

export function setBusinessNowMs(ms: number): void {
  businessNowMs = ms;
}

export function clearBusinessClock(): void {
  businessNowMs = null;
}

export function businessNowMsOr(isoFallback: string): number {
  if (businessNowMs !== null) return businessNowMs;
  return new Date(isoFallback).getTime();
}

export function monotonicNowMs(): number {
  return performance.now();
}

export function virtualDayKey(iso: string): string {
  return iso.slice(0, 10);
}
