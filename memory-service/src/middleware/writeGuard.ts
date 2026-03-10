/**
 * Write guard — blocks write operations when X-User-Id is missing or empty.
 *
 * Only rejects when the header is absent or blank. Explicit X-User-Id values
 * (including "default") are allowed.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function writeGuardMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip for health checks and docs (no user context)
  if (request.url === '/health' || request.url.startsWith('/docs')) {
    return;
  }

  const method = request.method?.toUpperCase() ?? 'GET';
  if (READ_ONLY_METHODS.has(method)) {
    return;
  }

  const rawUserId = request.headers['x-user-id'];
  const isEmpty =
    rawUserId == null ||
    (typeof rawUserId === 'string' && rawUserId.trim() === '');

  if (isEmpty) {
    return reply.status(403).send({
      error:
        'X-User-Id header is required for write operations. ' +
        'Please provide your user identifier (e.g. esone.qiu).',
    });
  }
}
