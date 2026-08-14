/**
 * Personal API key management (tier 2).
 *
 * Issuance requires a trusted issuer:
 *  - bootstrap key (keys.issue only) — shipped with the extension
 *  - full service key — desktop / ops
 *  - an existing user key for the same user
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

  app.post<{
    Body?: { label?: string; scopes?: unknown };
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

    const issued = issueUserApiKey(request.userContext.db, userId, {
      label: request.body?.label,
      scopes: normalizeScopes(request.body?.scopes),
      issuedFromIp: clientIp(request),
      issuedFromUa: ua,
    });

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
