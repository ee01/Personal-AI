/**
 * Agent Worker wire protocol constants and credential layout.
 * Worker is a channel (not an executor type). Protocol version is negotiated
 * at pair/heartbeat; incompatible workers are rejected with an upgrade hint.
 *
 * Token layout: `awk.<base64url(userId)>.<workerId>.<secret>`
 * userId is not a secret — it only selects the per-user database.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const WORKER_PROTOCOL_VERSION = 1;
export const WORKER_MIN_PROTOCOL_VERSION = 1;
export const WORKER_HEARTBEAT_INTERVAL_SECONDS = 15;
export const WORKER_STALE_AFTER_SECONDS = 30;
export const WORKER_LEASE_SECONDS = 5 * 60;
export const WORKER_PAIRING_TTL_SECONDS = 15 * 60;
export const WORKER_KEY_PREFIX = 'awk';
export const PAIRING_TOKEN_PREFIX = 'wpt';
export const PROBE_CACHE_TTL_MS = 5 * 60_000;

export type WorkerHostKind = 'desktop' | 'headless';
export type WorkerStatus = 'pairing' | 'online' | 'stale' | 'error' | 'revoked';

export interface WorkerCapabilities {
  acpCodex?: boolean;
  acpClaudeCode?: boolean;
  echo?: boolean;
  protocolVersion?: number;
}

export interface ParsedWorkerKey {
  userId: string;
  workerId: string;
  token: string;
}

function encodeUserId(userId: string): string {
  return Buffer.from(userId, 'utf8').toString('base64url');
}

function decodeUserId(encoded: string): string | null {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function hashWorkerSecret(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function parsePairingToken(
  token: string | undefined | null,
): { userId: string; token: string } | null {
  if (!token || !token.startsWith(`${PAIRING_TOKEN_PREFIX}.`)) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const userId = decodeUserId(parts[1] || '');
  const secret = parts[2] || '';
  if (!userId || !secret) return null;
  return { userId, token };
}

export function parseWorkerKey(
  token: string | undefined | null,
): ParsedWorkerKey | null {
  if (!token || !token.startsWith(`${WORKER_KEY_PREFIX}.`)) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const userId = decodeUserId(parts[1] || '');
  const workerId = (parts[2] || '').trim();
  const secret = parts[3] || '';
  if (!userId || !workerId || !secret) return null;
  return { userId, workerId, token };
}

export function issueWorkerCredential(userId: string, workerId: string): {
  token: string;
  hash: string;
  prefix: string;
} {
  const secret = randomBytes(24).toString('base64url');
  const token = `${WORKER_KEY_PREFIX}.${encodeUserId(userId)}.${workerId}.${secret}`;
  return {
    token,
    hash: hashWorkerSecret(token),
    prefix: `${WORKER_KEY_PREFIX}.${encodeUserId(userId)}.${workerId}.`,
  };
}

export function newWorkerId(): string {
  return randomUUID();
}

export function newPairingToken(userId: string): string {
  const secret = randomBytes(24).toString('base64url');
  return `${PAIRING_TOKEN_PREFIX}.${encodeUserId(userId)}.${secret}`;
}

export function isWorkerStale(
  lastHeartbeatAt: number | null | undefined,
  nowSeconds: number,
): boolean {
  if (!lastHeartbeatAt) return true;
  return nowSeconds - lastHeartbeatAt > WORKER_STALE_AFTER_SECONDS;
}

export function protocolCompatible(reported: number | undefined): boolean {
  const version = Number(reported);
  if (!Number.isFinite(version)) return false;
  return version >= WORKER_MIN_PROTOCOL_VERSION;
}
