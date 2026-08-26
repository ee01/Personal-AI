/**
 * Personal API key management (tier 2).
 *
 * Issuance requires a trusted issuer:
 *  - bootstrap key — may only *claim* a brand-new namespace (TOFU)
 *  - full service key — desktop / ops
 *  - an existing user key for the same user
 *  - Google access-token verification (already-claimed namespaces)
 *  - an approved device_key_request (admin path)
 *  - open local-dev when neither API_KEY nor BOOTSTRAP_API_KEY is set
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  expectedBootstrapKey,
  expectedServiceKey,
} from '../middleware/auth.js';
import {
  DEFAULT_USER_API_KEY_SCOPES,
  countRecentUserApiKeyIssues,
  issueUserApiKey,
  listUserApiKeys,
  revokeUserApiKey,
  type UserApiKeyScope,
} from '../core/auth/userApiKeys.js';
import {
  isNamespaceClaimable,
  recordClaim,
} from '../core/auth/userClaim.js';
import {
  configuredGoogleClientIds,
  verifyGoogleAccessToken,
} from '../core/auth/googleIdentity.js';
import {
  googleEmailMatchesUser,
  upsertIdentityAlias,
} from '../core/auth/identityAliases.js';
import {
  consumeDeviceKeyRequest,
  createDeviceKeyRequest,
  findApprovedDeviceKeyRequestByLabel,
  getDeviceKeyRequest,
} from '../core/auth/deviceKeyRequests.js';
import { getConfig } from '../config.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';

const ALLOWED_SCOPES: UserApiKeyScope[] = [
  'memory.read',
  'memory.write',
  'evidence.raw.read',
];

/** Max active keys a single user may mint per rolling hour. */
const ISSUE_RATE_LIMIT_PER_HOUR = 10;

/**
 * Guard the issuance path. Returns true when the request may manage keys for
 * `request.userId`.
 */
function isTrustedIssuer(request: FastifyRequest): boolean {
  if (request.authMode === 'user_key') return true;
  if (request.authMode === 'bootstrap_key') return true;
  const serviceKey = expectedServiceKey();
  const bootstrapKey = expectedBootstrapKey();
  // No service/bootstrap key configured (local dev): the service is already open.
  if (!serviceKey && !bootstrapKey) return true;
  return request.authMode === 'service_key';
}

function requireExplicitUser(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  if (request.authMode === 'user_key') return request.userId;
  const resolved = resolveUserIdHeader(request.headers['x-user-id']);
  if (resolved.error) {
    reply.code(400).send({ error: resolved.error });
    return null;
  }
  if (resolved.fallbackToDefault) {
    reply.code(400).send({
      error: 'user_id_required',
      message:
        'X-User-Id is required to manage personal API keys. Resolve your identity first.',
    });
    return null;
  }
  return resolved.userId!;
}

function normalizeScopes(raw: unknown): UserApiKeyScope[] {
  if (!Array.isArray(raw)) return DEFAULT_USER_API_KEY_SCOPES;
  const scopes = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is UserApiKeyScope =>
      ALLOWED_SCOPES.includes(item as UserApiKeyScope),
    );
  return scopes.length ? scopes : DEFAULT_USER_API_KEY_SCOPES;
}

function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return request.ip || null;
}

function adminContact(): string {
  return String(getConfig().adminContactEmail || '').trim();
}

function verifyMethods(): string[] {
  return configuredGoogleClientIds().length ? ['google'] : [];
}

function alreadyClaimedBody(
  userId: string,
  extras: Record<string, unknown> = {},
) {
  return {
    error: 'user_already_claimed',
    message:
      'This user namespace is already claimed. Verify with Google or request admin approval.',
    userId,
    verifyMethods: verifyMethods(),
    adminContact: adminContact() || undefined,
    ...extras,
  };
}

type IssueBody = {
  label?: string;
  scopes?: unknown;
  verification?: {
    provider?: string;
    accessToken?: string;
  };
  /** Consume an admin-approved device key request. */
  requestId?: string;
};

export async function userKeyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users/me/keys', async (request, reply) => {
    if (!isTrustedIssuer(request)) {
      return reply.code(401).send({ error: 'issuer_not_trusted' });
    }
    const userId = requireExplicitUser(request, reply);
    if (!userId) return reply;
    return reply.send({
      userId,
      keys: listUserApiKeys(request.userContext.db),
    });
  });

  app.get<{
    Params: { id: string };
  }>('/users/me/key-requests/:id', async (request, reply) => {
    if (!isTrustedIssuer(request)) {
      return reply.code(401).send({ error: 'issuer_not_trusted' });
    }
    const userId = requireExplicitUser(request, reply);
    if (!userId) return reply;
    const record = getDeviceKeyRequest(
      request.userContext.db,
      request.params.id,
    );
    if (!record) {
      return reply.code(404).send({ error: 'request_not_found' });
    }
    return reply.send({ userId, request: record });
  });

  app.post<{
    Body?: IssueBody;
  }>('/users/me/keys', async (request, reply) => {
    if (!isTrustedIssuer(request)) {
      return reply.code(401).send({ error: 'issuer_not_trusted' });
    }
    const userId = requireExplicitUser(request, reply);
    if (!userId) return reply;

    const recent = countRecentUserApiKeyIssues(request.userContext.db);
    if (recent >= ISSUE_RATE_LIMIT_PER_HOUR) {
      return reply.code(429).send({
        error: 'key_issue_rate_limited',
        message: `At most ${ISSUE_RATE_LIMIT_PER_HOUR} keys may be issued per hour.`,
      });
    }

    const ua =
      typeof request.headers['user-agent'] === 'string'
        ? request.headers['user-agent']
        : null;
    const ip = clientIp(request);
    const db = request.userContext.db;
    const label = request.body?.label;
    const scopes = normalizeScopes(request.body?.scopes);
    const requestId = String(request.body?.requestId || '').trim();
    const verification = request.body?.verification;
    const claimable = isNamespaceClaimable(db);

    // ---- Path A: consume an admin-approved request ----
    if (requestId) {
      const pending = getDeviceKeyRequest(db, requestId);
      if (!pending) {
        return reply.code(404).send({ error: 'request_not_found' });
      }
      if (pending.status !== 'approved') {
        return reply.code(409).send({
          error: 'request_not_approved',
          status: pending.status,
          requestId,
          adminContact: adminContact() || undefined,
        });
      }
      const issued = issueUserApiKey(db, userId, {
        label,
        scopes,
        issuedFromIp: ip,
        issuedFromUa: ua,
      });
      consumeDeviceKeyRequest(db, requestId, issued.record.id);
      if (pending.googleEmail) {
        upsertIdentityAlias(db, pending.googleEmail, {
          addedBy: pending.decidedBy || 'admin',
          source: 'admin_approval',
        });
      }
      recordClaim(db, { issuedFromIp: ip, issuedFromUa: ua });
      return reply.code(201).send({
        userId,
        token: issued.token,
        key: issued.record,
        requestId,
      });
    }

    // ---- Path B: Google verification for already-claimed namespaces ----
    const googleToken =
      verification?.provider === 'google'
        ? String(verification.accessToken || '').trim()
        : '';
    if (googleToken) {
      const verified = await verifyGoogleAccessToken(googleToken);
      if (!verified.ok) {
        return reply.code(401).send({
          error: verified.error,
          message: verified.message,
          userId,
          verifyMethods: verifyMethods(),
          adminContact: adminContact() || undefined,
        });
      }
      if (googleEmailMatchesUser(db, userId, verified.identity.email)) {
        const issued = issueUserApiKey(db, userId, {
          label,
          scopes,
          issuedFromIp: ip,
          issuedFromUa: ua,
        });
        upsertIdentityAlias(db, verified.identity.email, {
          addedBy: 'google_self_serve',
          source: 'google_match',
        });
        if (claimable) {
          recordClaim(db, { issuedFromIp: ip, issuedFromUa: ua });
        }
        return reply.code(201).send({
          userId,
          token: issued.token,
          key: issued.record,
        });
      }

      // Email verified but does not match userId / alias → open approval.
      const created = createDeviceKeyRequest(db, {
        deviceLabel: label,
        ip,
        ua,
        googleEmail: verified.identity.email,
        mismatchReason: `google_email_mismatch:${verified.identity.email}`,
      });
      return reply.code(409).send(
        alreadyClaimedBody(userId, {
          error: 'google_email_mismatch',
          message:
            'Google email does not match this user id. An admin approval request was created.',
          requestId: created.id,
          googleEmail: verified.identity.email,
        }),
      );
    }

    // ---- Path C: bootstrap / service / user_key / anonymous-dev ----
    if (request.authMode === 'bootstrap_key' && !claimable) {
      // The client may not have carried the requestId from its original
      // attempt forward (e.g. an MV3 service worker that got evicted and
      // restarted before it polled/consumed the approval). deviceLabel is a
      // stable per-device fingerprint, so check for an approval under it
      // before opening yet another pending request for the same device.
      const approved = label
        ? findApprovedDeviceKeyRequestByLabel(db, label)
        : null;
      if (approved) {
        const issued = issueUserApiKey(db, userId, {
          label,
          scopes,
          issuedFromIp: ip,
          issuedFromUa: ua,
        });
        consumeDeviceKeyRequest(db, approved.id, issued.record.id);
        if (approved.googleEmail) {
          upsertIdentityAlias(db, approved.googleEmail, {
            addedBy: approved.decidedBy || 'admin',
            source: 'admin_approval',
          });
        }
        recordClaim(db, { issuedFromIp: ip, issuedFromUa: ua });
        return reply.code(201).send({
          userId,
          token: issued.token,
          key: issued.record,
        });
      }

      const created = createDeviceKeyRequest(db, {
        deviceLabel: label,
        ip,
        ua,
        mismatchReason: 'bootstrap_on_claimed_namespace',
      });
      return reply.code(409).send(
        alreadyClaimedBody(userId, { requestId: created.id }),
      );
    }

    const issued = issueUserApiKey(db, userId, {
      label,
      scopes,
      issuedFromIp: ip,
      issuedFromUa: ua,
    });
    if (claimable) {
      recordClaim(db, { issuedFromIp: ip, issuedFromUa: ua });
    }
    return reply.code(201).send({
      userId,
      // Plaintext is returned exactly once; only the hash is stored.
      token: issued.token,
      key: issued.record,
    });
  });

  app.delete<{ Params: { id: string } }>(
    '/users/me/keys/:id',
    async (request, reply) => {
      if (!isTrustedIssuer(request)) {
        return reply.code(401).send({ error: 'issuer_not_trusted' });
      }
      const userId = requireExplicitUser(request, reply);
      if (!userId) return reply;

      const revoked = revokeUserApiKey(request.userContext.db, request.params.id);
      if (!revoked) {
        return reply.code(404).send({ error: 'key_not_found' });
      }
      return reply.send({ userId, revoked: request.params.id });
    },
  );
}
