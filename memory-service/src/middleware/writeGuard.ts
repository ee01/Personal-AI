/**
 * Write guard — blocks write operations when the caller has no identity.
 *
 * Only rejects when `X-User-Id` is absent or blank and no tier-2 user key is
 * presented. Explicit X-User-Id values (including "default") are allowed.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { looksLikeUserApiKey } from '../core/auth/userApiKeys.js';
import { parseBearerToken } from '../mcp/streamableHttp.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function writeGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip for health checks, docs, and MCP HTTP (self-authed bearer)
  if (
    request.url === '/health' ||
    request.url.startsWith('/docs') ||
    request.url.split('?')[0] === '/mcp'
  ) {
    return;
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  if (READ_ONLY_METHODS.has(method)) {
    return;
  }

  // A tier-2 user key carries the identity itself, so X-User-Id is optional.
  // Auth middleware still verifies the token and its write scope.
  if (
    looksLikeUserApiKey(
      parseBearerToken(
        typeof request.headers.authorization === 'string'
          ? request.headers.authorization
          : undefined,
      ),
    )
  ) {
    return;
  }

  const resolvedUserId = resolveUserIdHeader(request.headers['x-user-id']);

  if (resolvedUserId.error) {
    return reply.status(400).send({ error: resolvedUserId.error });
  }

  if (resolvedUserId.fallbackToDefault) {
    return reply.status(403).send({
      error:
        'X-User-Id header is required for write operations. ' +
        'Please provide your user identifier (e.g. esone.qiu).',
    });
  }
}
