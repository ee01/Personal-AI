/**
 * After agent.wait times out, keep the local action running and confirm the
 * remote run with backoff. Still-running is a successful confirm (wait longer).
 * Only repeated inconclusive checks become dead_letter.
 */

import type { AgentRunStatus } from './AgentExecutor.js';

export const GATEWAY_RUN_CONFIRM_INTERVALS_MS = [30_000, 60_000, 120_000] as const;

export const GATEWAY_RUN_CONFIRM_MAX_ATTEMPTS =
  GATEWAY_RUN_CONFIRM_INTERVALS_MS.length;

const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  'succeeded',
  'failed',
  'error',
  'auth_error',
  'capability_missing',
  'cancelled',
  'need_human_decision',
]);

export function isAgentRunTerminalStatus(
  status: string | undefined,
): boolean {
  return TERMINAL_STATUSES.has(status as AgentRunStatus);
}

/** Wait timed out or remote still active — keep confirming, do not dead-letter. */
export function shouldContinueWaiting(status: string | undefined): boolean {
  return status === 'running' || status === 'timeout' || status === 'queued';
}

export function isWaitRpcTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /OpenClaw gateway RPC timeout:\s*agent\.wait/i.test(message);
}

export function nextGatewayConfirmIntervalMs(attempt: number): number {
  const index = Math.max(0, Math.min(attempt, GATEWAY_RUN_CONFIRM_INTERVALS_MS.length - 1));
  return GATEWAY_RUN_CONFIRM_INTERVALS_MS[index];
}

export function defaultGatewayConfirmSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function readActionRemoteRunId(
  result: Record<string, unknown> | undefined | null,
): string {
  if (!result || typeof result !== 'object') return '';
  if (typeof result.remoteRunId === 'string' && result.remoteRunId.trim()) {
    return result.remoteRunId.trim();
  }
  const payload = result.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).remoteRunId;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return '';
}

export function buildGatewayConfirmExhaustedError(
  remoteRunId: string,
  attempts: number,
): string {
  return (
    `OpenClaw remote run ${remoteRunId} could not be confirmed after ${attempts} status checks. ` +
    'The external operation may have completed without returning to Memory Service; review before retrying to avoid duplicate writes.'
  );
}
