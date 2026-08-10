/**
 * Minimal MCP Streamable HTTP JSON-RPC handler (stateless).
 * Speaks initialize / tools/list / tools/call / ping without pulling the full SDK.
 */

import { MCP_TOOLS, callMcpTool, type McpToolContext } from './tools.js';

export type McpJsonRpcId = string | number | null;

export interface McpJsonRpcRequest {
  jsonrpc?: '2.0';
  id?: McpJsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: McpJsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'personal-memory', version: '1.1.0' };

function isNotification(req: McpJsonRpcRequest): boolean {
  return req.id === undefined;
}

async function handleOne(
  req: McpJsonRpcRequest,
  ctx: McpToolContext,
): Promise<McpJsonRpcResponse | null> {
  const method = String(req.method || '');
  const id = (req.id ?? null) as McpJsonRpcId;

  if (isNotification(req)) {
    // notifications/initialized and similar — no response body.
    return null;
  }

  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    }

    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        },
      };
    }

    if (method === 'tools/call') {
      const params = (req.params || {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      const name = String(params.name || '');
      const args =
        params.arguments && typeof params.arguments === 'object'
          ? params.arguments
          : {};
      const result = await callMcpTool(name, args, ctx);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          isError:
            result != null &&
            typeof result === 'object' &&
            'error' in (result as object),
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function handleMcpJsonRpc(
  body: unknown,
  ctx: McpToolContext,
): Promise<{
  status: number;
  body: McpJsonRpcResponse | McpJsonRpcResponse[] | null;
}> {
  if (Array.isArray(body)) {
    const responses: McpJsonRpcResponse[] = [];
    for (const item of body) {
      const res = await handleOne(item as McpJsonRpcRequest, ctx);
      if (res) responses.push(res);
    }
    return { status: 200, body: responses };
  }

  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      body: {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      },
    };
  }

  const res = await handleOne(body as McpJsonRpcRequest, ctx);
  if (!res) {
    // Notification — Streamable HTTP uses 202 Accepted with empty body.
    return { status: 202, body: null };
  }
  return { status: 200, body: res };
}

export function isOriginAllowed(
  origin: string | undefined,
  allowlist: string[],
): boolean {
  if (!allowlist.length) return true;
  if (!origin) return false;
  return allowlist.some((entry) => {
    if (entry === '*') return true;
    return entry.trim() === origin.trim();
  });
}

export function parseBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match ? match[1].trim() : null;
}

export function parseOauthScopes(raw: string | undefined): string[] {
  if (!raw) return ['memory.read'];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
