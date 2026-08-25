/**
 * Server-side Google access-token verification via tokeninfo.
 *
 * Extension ships access tokens (chrome.identity.getAuthToken), not id_tokens.
 * We must check aud against our OAuth client ids so arbitrary Google tokens
 * from other apps cannot mint keys.
 */

import { getConfig } from '../../config.js';

export interface GoogleTokenIdentity {
  email: string;
  emailVerified: boolean;
  aud: string;
  expiresAt: number;
}

export type GoogleVerifyFailure =
  | 'google_not_configured'
  | 'token_invalid'
  | 'aud_mismatch'
  | 'email_unverified'
  | 'email_domain_not_allowed'
  | 'token_expired'
  | 'tokeninfo_unreachable';

export type GoogleVerifyResult =
  | { ok: true; identity: GoogleTokenIdentity }
  | { ok: false; error: GoogleVerifyFailure; message: string };

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const FETCH_TIMEOUT_MS = 8_000;

function parseCsvList(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function configuredGoogleClientIds(): string[] {
  return parseCsvList(getConfig().googleOAuthClientIds);
}

export function configuredGoogleEmailDomains(): string[] {
  return parseCsvList(getConfig().googleAllowedEmailDomains).map((d) =>
    d.toLowerCase(),
  );
}

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at >= 0 ? email.slice(at + 1).toLowerCase() : '';
}

export async function verifyGoogleAccessToken(
  accessToken: string,
  options: {
    fetchImpl?: typeof fetch;
    now?: number;
  } = {},
): Promise<GoogleVerifyResult> {
  const token = String(accessToken || '').trim();
  if (!token) {
    return {
      ok: false,
      error: 'token_invalid',
      message: 'Google access token is required.',
    };
  }

  const clientIds = configuredGoogleClientIds();
  if (!clientIds.length) {
    return {
      ok: false,
      error: 'google_not_configured',
      message:
        'GOOGLE_OAUTH_CLIENT_IDS is not configured; Google verification is unavailable.',
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let payload: Record<string, unknown>;
  try {
    const url = `${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`;
    const response = await fetchImpl(url, { signal: controller.signal });
    const body = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !body) {
      return {
        ok: false,
        error: 'token_invalid',
        message: 'Google rejected the access token.',
      };
    }
    payload = body;
  } catch {
    return {
      ok: false,
      error: 'tokeninfo_unreachable',
      message: 'Could not reach Google tokeninfo.',
    };
  } finally {
    clearTimeout(timer);
  }

  const aud = String(payload.aud || payload.azp || '').trim();
  const email = String(payload.email || '')
    .trim()
    .toLowerCase();
  const emailVerified =
    payload.email_verified === true ||
    payload.email_verified === 'true' ||
    payload.verified_email === true ||
    payload.verified_email === 'true';
  const expRaw = Number(payload.exp);
  const expiresAt = Number.isFinite(expRaw) ? expRaw : 0;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  if (!aud || !clientIds.includes(aud)) {
    return {
      ok: false,
      error: 'aud_mismatch',
      message: 'Google token audience does not match this extension.',
    };
  }
  if (!email) {
    return {
      ok: false,
      error: 'token_invalid',
      message: 'Google token did not include an email claim.',
    };
  }
  if (!emailVerified) {
    return {
      ok: false,
      error: 'email_unverified',
      message: 'Google email is not verified.',
    };
  }
  if (expiresAt > 0 && expiresAt < now) {
    return {
      ok: false,
      error: 'token_expired',
      message: 'Google access token has expired.',
    };
  }

  const allowedDomains = configuredGoogleEmailDomains();
  if (allowedDomains.length) {
    const domain = emailDomain(email);
    if (!domain || !allowedDomains.includes(domain)) {
      return {
        ok: false,
        error: 'email_domain_not_allowed',
        message: `Email domain ${domain || '(missing)'} is not allowed.`,
      };
    }
  }

  return {
    ok: true,
    identity: {
      email,
      emailVerified: true,
      aud,
      expiresAt,
    },
  };
}
