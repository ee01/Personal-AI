import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserContextManager } from '../core/UserContextManager.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';

/**
 * Create a Fastify `onRequest` hook that resolves the caller's identity
 * from the `X-User-Id` header and attaches a UserContext to the request.
 *
 * - If the header is missing, the request is attributed to the `"default"` user
 *   (backward-compatible single-user behaviour).
 * - Health-check and documentation endpoints are skipped entirely.
 */
export function createAuthMiddleware(ucm: UserContextManager) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Skip auth for health checks, docs, and CORS preflight
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.method === 'OPTIONS'
    ) {
      return;
    }

    const resolvedUserId = resolveUserIdHeader(
      request.headers['x-user-id'],
    );
    if (resolvedUserId.error) {
      return reply.code(400).send({ error: resolvedUserId.error });
    }

    const userId = resolvedUserId.userId ?? 'default';
    request.userId = userId;
    request.userContext = ucm.getContext(userId);
  };
}
