import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserContextManager } from '../core/UserContextManager.js';
import {
  parseUserApiKey,
  verifyUserApiKey,
} from '../core/auth/userApiKeys.js';
import { getConfig } from '../config.js';
import { parseBearerToken } from '../mcp/streamableHttp.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';
import {
  parsePairingToken,
  parseWorkerKey,
} from '../integrations/workers/workerProtocol.js';
import { AgentWorkerRepository } from '../repositories/AgentWorkerRepository.js';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Tier-1 service key: first-party clients (extension, desktop app). Empty in
 * local dev, which keeps the service open exactly as before.
 */
export function expectedServiceKey(): string {
  return process.env.API_KEY || getConfig().apiKey || '';
}

/** Issue-only bootstrap key shipped with the extension. Cannot read/write memory. */
export function expectedBootstrapKey(): string {
  return process.env.BOOTSTRAP_API_KEY || getConfig().bootstrapApiKey || '';
}

const KEYS_PATH_RE =
  /^\/api\/v1\/users\/me\/(?:keys|key-requests)(?:\/|$)/;

/**
 * Browser chrome probes. Chrome/Safari request these without Authorization
 * when any HTML page (docs, usage dashboard) is opened. They are not APIs.
 */
const BROWSER_PROBE_PATH_RE =
  /^\/(?:favicon\.ico|robots\.txt|apple-touch-icon(?:-precomposed)?\.png)$/;

function isBrowserProbeRequest(request: FastifyRequest): boolean {
  const method = request.method?.toUpperCase() ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;
  return BROWSER_PROBE_PATH_RE.test(request.url.split('?')[0]);
}

/**
 * Endpoints that authenticate themselves with an admin/analytics token
 * instead of a service/personal key (browser-openable pages).
 */
const ADMIN_SELF_AUTH_PATH_RE =
  /^\/api\/v1\/(?:usage\/(?:dashboard|report|users)|admin\/key-requests(?:\/|$))/;

function hasAdminOrAnalyticsToken(request: FastifyRequest): boolean {
  const header =
    request.headers['x-analytics-token'] || request.headers['x-admin-token'];
  const headerValue = Array.isArray(header) ? header[0] : header;
  if (typeof headerValue === 'string' && headerValue.trim()) return true;

  const queryStart = request.url.indexOf('?');
  if (queryStart < 0) return false;
  const token = new URLSearchParams(request.url.slice(queryStart + 1)).get(
    'token',
  );
  return Boolean(token && token.trim());
}

function isAdminSelfAuthRequest(request: FastifyRequest): boolean {
  const method = request.method?.toUpperCase() ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return false;
  if (!ADMIN_SELF_AUTH_PATH_RE.test(request.url.split('?')[0])) return false;
  return hasAdminOrAnalyticsToken(request);
}

/**
 * Create a Fastify `onRequest` hook that resolves the caller's identity.
 *
 * Credential tiers:
 *  - Tier-2 user key (`pak.…`) binds the request to exactly that user.
 *  - Bootstrap key may only call `/users/me/keys` (scope keys.issue).
 *  - Full service key may act for any user via `X-User-Id`.
 *  - When `API_KEY` is set, anonymous `X-User-Id` is rejected (401).
 *  - When `API_KEY` is empty (local-dev), identity may come from `X-User-Id`.
 */
export function createAuthMiddleware(ucm: UserContextManager) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Skip auth for health checks, docs, MCP HTTP (self-authed), signed usage
    // dashboard reads (self-authed), browser chrome probes, and CORS preflight
    if (
      request.url === '/health' ||
      request.url.startsWith('/docs') ||
      request.url.split('?')[0] === '/mcp' ||
      request.method === 'OPTIONS' ||
      isBrowserProbeRequest(request) ||
      isAdminSelfAuthRequest(request)
    ) {
      return;
    }

    const bearer = parseBearerToken(
      typeof request.headers.authorization === 'string'
        ? request.headers.authorization
        : undefined,
    );
    const parsedUserKey = parseUserApiKey(bearer);

    const pairing = parsePairingToken(bearer);
    const pathOnly = request.url.split('?')[0];
    if (pairing && pathOnly === '/api/v1/agent-workers/pair') {
      request.userId = pairing.userId;
      request.userContext = ucm.getContext(pairing.userId);
      request.authMode = 'anonymous';
      return;
    }

    const workerKey = parseWorkerKey(bearer);
    if (workerKey) {
      const context = ucm.getContext(workerKey.userId);
      const repo = new AgentWorkerRepository(context.db);
      const worker = repo.verifyCredential(workerKey.workerId, workerKey.token);
      if (!worker) {
        return reply.code(401).send({ error: 'invalid_worker_key' });
      }
      request.userId = workerKey.userId;
      request.userContext = context;
      request.authMode = 'worker_key';
      request.workerId = workerKey.workerId;
      return;
    }

    if (parsedUserKey) {
      const headerUserId = resolveUserIdHeader(request.headers['x-user-id']);
      if (headerUserId.error) {
        return reply.code(400).send({ error: headerUserId.error });
      }
      if (
        !headerUserId.fallbackToDefault &&
        headerUserId.userId !== parsedUserKey.userId
      ) {
        return reply.code(403).send({
          error: 'user_key_user_mismatch',
          message:
            'This API key is bound to a different user than X-User-Id. Drop the header or use that user\'s key.',
        });
      }

      const context = ucm.getContext(parsedUserKey.userId);
      const record = verifyUserApiKey(context.db, parsedUserKey.token);
      if (!record) {
        return reply.code(401).send({ error: 'invalid_user_api_key' });
      }

      const method = request.method?.toUpperCase() ?? 'GET';
      if (
        !READ_ONLY_METHODS.has(method) &&
        !record.scopes.includes('memory.write')
      ) {
        return reply.code(403).send({
          error: 'user_key_scope_insufficient',
          message: 'This API key is read-only. Issue a key with memory.write to modify memory.',
        });
      }

      request.userId = parsedUserKey.userId;
      request.userContext = context;
      request.authMode = 'user_key';
      request.authScopes = record.scopes;
      return;
    }

    const bootstrapKey = expectedBootstrapKey();
    if (bootstrapKey && bearer === bootstrapKey) {
      const pathOnly = request.url.split('?')[0];
      if (!KEYS_PATH_RE.test(pathOnly)) {
        return reply.code(403).send({
          error: 'bootstrap_key_scope_insufficient',
          message:
            'This bootstrap key can only manage personal API keys (POST/GET/DELETE /users/me/keys and GET /users/me/key-requests).',
        });
      }
      const resolvedUserId = resolveUserIdHeader(request.headers['x-user-id']);
      if (resolvedUserId.error) {
        return reply.code(400).send({ error: resolvedUserId.error });
      }
      if (resolvedUserId.fallbackToDefault) {
        return reply.code(400).send({
          error: 'user_id_required',
          message: 'X-User-Id is required when using the bootstrap key.',
        });
      }
      const userId = resolvedUserId.userId!;
      request.userId = userId;
      request.userContext = ucm.getContext(userId);
      request.authMode = 'bootstrap_key';
      request.authScopes = ['keys.issue'];
      return;
    }

    const resolvedUserId = resolveUserIdHeader(request.headers['x-user-id']);
    if (resolvedUserId.error) {
      return reply.code(400).send({ error: resolvedUserId.error });
    }

    const serviceKey = expectedServiceKey();
    if (serviceKey && bearer === serviceKey) {
      const userId = resolvedUserId.userId ?? 'default';
      request.userId = userId;
      request.userContext = ucm.getContext(userId);
      request.authMode = 'service_key';
      return;
    }

    // When a service key is configured, anonymous X-User-Id spoofing is closed.
    // Clients must present a personal pak.… key, the bootstrap key (keys only),
    // or the full service key. Local/dev with empty API_KEY stays open.
    if (serviceKey) {
      return reply.code(401).send({
        error: 'authentication_required',
        message:
          'Authorization Bearer required. Use a personal API key (pak.…), or the service key with X-User-Id.',
      });
    }

    const userId = resolvedUserId.userId ?? 'default';
    request.userId = userId;
    request.userContext = ucm.getContext(userId);
    request.authMode = 'anonymous';
  };
}
