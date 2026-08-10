/**
 * Write guard — blocks write operations when X-User-Id is missing or empty.
 *
 * Only rejects when the header is absent or blank. Explicit X-User-Id values
 * (including "default") are allowed.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
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
