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
import {
  parsePairingToken,
  parseWorkerKey,
} from '../integrations/workers/workerProtocol.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function writeGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip for health checks, docs, MCP HTTP, and admin self-auth writes
  // (device-key approval page and PUT /usage/pricing use ?token=/
  // X-Analytics-Token instead of X-User-Id — see middleware/auth.ts's
  // ADMIN_SELF_AUTH_PATH_RE, which is the actual gate for these paths; this
  // guard only needs to get out of the way so that check runs).
  const pathOnly = request.url.split('?')[0];
  if (
    request.url === '/health' ||
    request.url.startsWith('/docs') ||
    pathOnly === '/mcp' ||
    pathOnly.startsWith('/api/v1/admin/key-requests') ||
    pathOnly === '/api/v1/usage/pricing'
  ) {
    return;
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  if (READ_ONLY_METHODS.has(method)) {
    return;
  }

  // A tier-2 user key carries the identity itself, so X-User-Id is optional.
  // Auth middleware still verifies the token and its write scope.
  const bearer = parseBearerToken(
    typeof request.headers.authorization === 'string'
      ? request.headers.authorization
      : undefined,
  );
  if (looksLikeUserApiKey(bearer)) {
    return;
  }
  if (parseWorkerKey(bearer) || parsePairingToken(bearer)) {
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
