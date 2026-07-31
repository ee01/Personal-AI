/**
 * HMAC-signed usage-dashboard tokens.
 *
 * Format: base64url(JSON({u,s,exp})).base64url(HMAC-SHA256(payload, secret))
 * - u: userId
 * - s: 'self' | 'all'
 * - exp: expiry unix seconds
 *
 * No DB table / no backfill. Revocation = rotate ANALYTICS_TOKEN_SECRET.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { isValidUserId } from '../utils/userIdentity.js';

export type UsageTokenScope = 'self' | 'all';

export interface UsageTokenClaims {
  userId: string;
  scope: UsageTokenScope;
  expiresAt: number; // epoch ms
}

export interface SignUsageTokenInput {
  userId: string;
  scope: UsageTokenScope;
  secret: string;
  /** Lifetime in days (default 180). */
  ttlDays?: number;
}

const DEFAULT_TTL_DAYS = 180;

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Issue a signed usage token. Returns the raw token string (not URL-encoded).
 */
export function signUsageToken(input: SignUsageTokenInput): {
  token: string;
  claims: UsageTokenClaims;
} {
  const userId = input.userId.trim();
  if (!isValidUserId(userId)) {
    throw new Error('Invalid userId for usage token');
  }
  if (input.scope !== 'self' && input.scope !== 'all') {
    throw new Error('Invalid usage token scope');
  }
  if (!input.secret) {
    throw new Error('Usage token secret is not configured');
  }

  const ttlDays =
    typeof input.ttlDays === 'number' && input.ttlDays > 0
      ? Math.min(Math.floor(input.ttlDays), 3650)
      : DEFAULT_TTL_DAYS;
  const expiresAtSec = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  const body = {
    u: userId,
    s: input.scope,
    exp: expiresAtSec,
  };
  const payload = b64url(JSON.stringify(body));
  const sig = signPayload(payload, input.secret);
  return {
    token: `${payload}.${sig}`,
    claims: {
      userId,
      scope: input.scope,
      expiresAt: expiresAtSec * 1000,
    },
  };
}

/**
 * Verify a signed usage token. Returns claims on success, null on any failure.
 */
export function verifyUsageToken(
  token: string | null | undefined,
  secret: string,
  nowMs: number = Date.now(),
): UsageTokenClaims | null {
  if (!token || !secret) return null;
  const trimmed = token.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return null;

  const payload = trimmed.slice(0, dot);
  const sig = trimmed.slice(dot + 1);
  const expected = signPayload(payload, secret);
  if (!safeEqual(sig, expected)) return null;

  let body: { u?: unknown; s?: unknown; exp?: unknown };
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const userId = typeof body.u === 'string' ? body.u.trim() : '';
  const scope = body.s === 'all' || body.s === 'self' ? body.s : null;
  const expSec = typeof body.exp === 'number' ? body.exp : NaN;
  if (!isValidUserId(userId) || !scope || !Number.isFinite(expSec)) {
    return null;
  }
  if (expSec * 1000 <= nowMs) return null;

  return {
    userId,
    scope,
    expiresAt: expSec * 1000,
  };
}
