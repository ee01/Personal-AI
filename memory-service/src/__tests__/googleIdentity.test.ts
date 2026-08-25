/**
 * Google access-token verification (mocked tokeninfo).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfigForTests } from '../config.js';
import { verifyGoogleAccessToken } from '../core/auth/googleIdentity.js';

describe('verifyGoogleAccessToken', () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'GOOGLE_OAUTH_CLIENT_IDS',
      'GOOGLE_ALLOWED_EMAIL_DOMAINS',
    ]) {
      prev[key] = process.env[key];
    }
    process.env.GOOGLE_OAUTH_CLIENT_IDS = 'ext-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_ALLOWED_EMAIL_DOMAINS = 'ringcentral.com';
    resetConfigForTests();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfigForTests();
  });

  function mockFetch(body: Record<string, unknown>, status = 200) {
    return vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })) as unknown as typeof fetch;
  }

  it('accepts a valid token with matching aud and domain', async () => {
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({
        aud: 'ext-client-id.apps.googleusercontent.com',
        email: 'esone.qiu@ringcentral.com',
        email_verified: 'true',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.email).toBe('esone.qiu@ringcentral.com');
    }
  });

  it('rejects aud mismatch', async () => {
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({
        aud: 'other-app.apps.googleusercontent.com',
        email: 'esone.qiu@ringcentral.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('aud_mismatch');
  });

  it('rejects unverified email', async () => {
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({
        aud: 'ext-client-id.apps.googleusercontent.com',
        email: 'esone.qiu@ringcentral.com',
        email_verified: false,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('email_unverified');
  });

  it('rejects domains outside the allowlist', async () => {
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({
        aud: 'ext-client-id.apps.googleusercontent.com',
        email: 'alice@gmail.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('email_domain_not_allowed');
  });

  it('skips domain check when allowlist is empty', async () => {
    process.env.GOOGLE_ALLOWED_EMAIL_DOMAINS = '';
    resetConfigForTests();
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({
        aud: 'ext-client-id.apps.googleusercontent.com',
        email: 'alice@gmail.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    });
    expect(result.ok).toBe(true);
  });

  it('rejects expired tokens', async () => {
    const result = await verifyGoogleAccessToken('tok', {
      now: 2_000_000_000,
      fetchImpl: mockFetch({
        aud: 'ext-client-id.apps.googleusercontent.com',
        email: 'esone.qiu@ringcentral.com',
        email_verified: true,
        exp: 1_999_999_000,
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('token_expired');
  });

  it('reports google_not_configured when client ids are empty', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_IDS = '';
    resetConfigForTests();
    const result = await verifyGoogleAccessToken('tok', {
      fetchImpl: mockFetch({}),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('google_not_configured');
  });
});
