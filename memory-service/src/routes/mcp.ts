/**
 * Streamable HTTP MCP endpoint (Block F).
 *
 * POST /mcp — JSON-RPC (initialize / tools/list / tools/call / ping)
 * GET  /mcp — discovery metadata (not SSE stream; clients may POST only)
 *
 * Auth: Bearer token must match API_KEY or MCP_BEARER_TOKEN.
 * Origin: when MCP_ALLOWED_ORIGINS is set, Origin header must match.
 * Scopes: MCP_OAUTH_SCOPES (comma) — include evidence.raw.read for raw evidence.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { getConfig } from '../config.js';
import {
  parseUserApiKey,
  verifyUserApiKey,
} from '../core/auth/userApiKeys.js';
import {
  handleMcpJsonRpc,
  isOriginAllowed,
  parseBearerToken,
  parseOauthScopes,
} from '../mcp/streamableHttp.js';
import type { McpScope, McpToolContext } from '../mcp/tools.js';
import { resolveUserIdHeader } from '../utils/userIdentity.js';

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function expectedBearer(): string {
  return (
    process.env.MCP_BEARER_TOKEN ||
    process.env.API_KEY ||
    getConfig().apiKey ||
    ''
  );
}

function mcpEnabled(): boolean {
  const raw = (process.env.MCP_HTTP_ENABLED || 'true').trim().toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

function resolveMcpUserId(request: FastifyRequest): string {
  const resolved = resolveUserIdHeader(request.headers['x-user-id']);
  if (resolved.userId) return resolved.userId;
  if (request.userId) return request.userId;
  return process.env.MCP_USER_ID || 'default';
}

function buildCtx(request: FastifyRequest, userId: string): McpToolContext {
  const config = getConfig();
  const allowedScopes = (envList('MCP_ALLOWED_SCOPES').length
    ? envList('MCP_ALLOWED_SCOPES')
    : ['work']) as McpScope[];
  const host = request.headers.host || `127.0.0.1:${config.port}`;
  const proto =
    (request.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ||
    'http';
  const baseUrl =
    process.env.MEMORY_SERVICE_PUBLIC_URL ||
    process.env.MEMORY_SERVICE_URL ||
    `${proto}://${host}`;

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    userId,
    apiKey: expectedBearer() || undefined,
    allowedScopes,
    oauthScopes: parseOauthScopes(process.env.MCP_OAUTH_SCOPES),
    clientInfo: String(request.headers['user-agent'] || 'mcp-http'),
    fetchFn: fetch,
  };
}

function rejectUnauthorized(reply: FastifyReply, message: string) {
  return reply.code(401).send({ error: message });
}

function checkOrigin(request: FastifyRequest, reply: FastifyReply): boolean {
  const allowlist = envList('MCP_ALLOWED_ORIGINS');
  const origin = request.headers.origin;
  if (!isOriginAllowed(typeof origin === 'string' ? origin : undefined, allowlist)) {
    reply.code(403).send({ error: 'origin_not_allowed' });
    return false;
  }
  return true;
}

/**
 * Accept either a tier-2 personal key (binds the session to its owner) or the
 * tier-1 service bearer. Returns the userId to serve, or null when rejected.
 */
function authorizeMcp(
  request: FastifyRequest,
  reply: FastifyReply,
): { userId: string } | null {
  const token = parseBearerToken(
    typeof request.headers.authorization === 'string'
      ? request.headers.authorization
      : undefined,
  );

  const parsedUserKey = parseUserApiKey(token);
  if (parsedUserKey) {
    const context = request.server.userContextManager.getContext(
      parsedUserKey.userId,
    );
    if (!verifyUserApiKey(context.db, parsedUserKey.token)) {
      rejectUnauthorized(reply, 'invalid_user_api_key');
      return null;
    }
    return { userId: parsedUserKey.userId };
  }

  const expected = expectedBearer();
  if (!expected) {
    // Dev-friendly: if no API key configured, allow local unsigned MCP.
    return { userId: resolveMcpUserId(request) };
  }
  if (!token || token !== expected) {
    rejectUnauthorized(reply, 'invalid_bearer_token');
    return null;
  }
  return { userId: resolveMcpUserId(request) };
}

export async function mcpHttpRoutes(app: FastifyInstance): Promise<void> {
  app.get('/mcp', async (request, reply) => {
    if (!mcpEnabled()) {
      return reply.code(404).send({ error: 'mcp_http_disabled' });
    }
    if (!checkOrigin(request, reply)) return;
    const auth = authorizeMcp(request, reply);
    if (!auth) return;
    return reply.code(200).send({
      name: 'personal-memory',
      transport: 'streamable-http',
      protocolVersion: '2024-11-05',
      endpoint: '/mcp',
      userId: auth.userId,
      tools: [
        'memory_search',
        'memory_ask',
        'memory_evidence_get',
        'memory_save',
        'memory_context_brief',
        'memory_profile_hint',
      ],
      auth: {
        type: 'bearer',
        scopesHint: parseOauthScopes(process.env.MCP_OAUTH_SCOPES),
      },
    });
  });

  app.post('/mcp', async (request, reply) => {
    if (!mcpEnabled()) {
      return reply.code(404).send({ error: 'mcp_http_disabled' });
    }
    if (!checkOrigin(request, reply)) return;
    const auth = authorizeMcp(request, reply);
    if (!auth) return;

    const handled = await handleMcpJsonRpc(
      request.body,
      buildCtx(request, auth.userId),
    );
    if (handled.status === 202) {
      return reply.code(202).send();
    }
    return reply
      .code(handled.status)
      .header('Content-Type', 'application/json')
      .header('MCP-Protocol-Version', '2024-11-05')
      .send(handled.body);
  });
}
