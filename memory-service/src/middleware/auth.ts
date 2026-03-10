import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserContextManager } from '../core/UserContextManager.js';

/**
 * Only alphanumeric characters, dots, hyphens, and underscores are allowed
 * in a user ID. This prevents path-traversal attacks and keeps directory
 * names filesystem-safe.
 */
const USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

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

    const rawUserId = request.headers['x-user-id'];
    let userId: string;

    if (!rawUserId || typeof rawUserId !== 'string') {
      // Backward compatibility: no header = default user
      userId = 'default';
    } else {
      if (!USER_ID_PATTERN.test(rawUserId)) {
        return reply.code(400).send({
          error:
            'Invalid X-User-Id format. Only a-z, 0-9, dots, hyphens, underscores allowed.',
        });
      }
      userId = rawUserId;
    }

    request.userId = userId;
    request.userContext = ucm.getContext(userId);
  };
}
