/**
 * AcpExecutor — drives @agentclientprotocol/codex-acp (or compatible) over stdio.
 * Injects Personal AI memory MCP for on-demand recall (no memory DB copy).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AgentExecutor,
  AgentResultEnvelope,
  AgentSubmitRequest,
} from './AgentExecutor.js';
import { parseAgentResultEnvelope } from './agentResultEnvelope.js';
import {
  buildAgentResultSystemPrompt,
  buildAgentResultUserPrompt,
} from './agentResultPrompt.js';
import type { AgentExecutorInstance } from './executorRegistry.js';
import {
  AcpStdioClient,
  acpCommandForType,
  type AcpMcpServerConfig,
  type AcpSpawnFn,
} from '../acp/AcpStdioClient.js';
import { getConfig } from '../../config.js';

function extractPromptText(result: unknown, updates: Array<Record<string, unknown>>): string {
  const chunks: string[] = [];
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (typeof obj.stopReason === 'string') {
      /* keep for payload */
    }
    if (Array.isArray(obj.output)) {
      for (const part of obj.output) {
        if (part && typeof part === 'object' && typeof (part as any).text === 'string') {
          chunks.push((part as any).text);
        }
      }
    }
    if (typeof obj.text === 'string') chunks.push(obj.text);
    if (typeof obj.message === 'string') chunks.push(obj.message);
  }
  for (const update of updates) {
    const updateObj = update.update || update;
    if (!updateObj || typeof updateObj !== 'object') continue;
    const u = updateObj as Record<string, unknown>;
    if (u.sessionUpdate === 'agent_message_chunk' && u.content) {
      const content = u.content as { text?: string };
      if (typeof content.text === 'string') chunks.push(content.text);
    }
    if (typeof u.text === 'string') chunks.push(u.text);
  }
  return chunks.join('');
}

function resolveMcpServers(options: {
  userId: string;
  memoryBaseUrl?: string;
  memoryApiKey?: string;
}): AcpMcpServerConfig[] {
  const baseUrl = (
    options.memoryBaseUrl ||
    process.env.MEMORY_SERVICE_PUBLIC_URL ||
    process.env.MEMORY_SERVICE_URL ||
    `http://127.0.0.1:${getConfig().port}`
  ).replace(/\/$/, '');

  // Prefer Streamable HTTP MCP when memory-service is reachable.
  const headers: Record<string, string> = {
    'X-User-Id': options.userId,
  };
  const token =
    options.memoryApiKey ||
    process.env.MCP_BEARER_TOKEN ||
    process.env.API_KEY ||
    getConfig().apiKey ||
    '';
  if (token) headers.Authorization = `Bearer ${token}`;

  const httpServer: AcpMcpServerConfig = {
    name: 'personal-memory',
    type: 'streamable-http',
    url: `${baseUrl}/mcp`,
    headers,
  };

  // Also offer stdio fallback path for agents that only accept command MCP.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerJs = path.resolve(here, '../../../mcp-server.mjs');
  const stdioServer: AcpMcpServerConfig = {
    name: 'personal-memory-stdio',
    command: process.execPath,
    args: [
      mcpServerJs,
      '--user-id',
      options.userId,
      '--base-url',
      baseUrl,
      '--scopes',
      process.env.MCP_ALLOWED_SCOPES || 'work',
      '--oauth-scopes',
      process.env.MCP_OAUTH_SCOPES || 'memory.read,evidence.raw.read',
      ...(token ? ['--api-key', token] : []),
    ],
  };

  return [httpServer, stdioServer];
}

export class AcpExecutor implements AgentExecutor {
  readonly id: string;
  readonly type: string;

  constructor(
    private readonly instance: AgentExecutorInstance,
    private readonly options: {
      userId: string;
      memoryBaseUrl?: string;
      memoryApiKey?: string;
      spawnFn?: AcpSpawnFn;
      defaultTimeoutMs?: number;
    },
  ) {
    this.id = instance.id;
    this.type = instance.type;
  }

  async submit(request: AgentSubmitRequest): Promise<AgentResultEnvelope> {
    const cwd =
      this.instance.cwd ||
      (typeof request.metadata?.cwd === 'string'
        ? request.metadata.cwd
        : undefined) ||
      process.cwd();
    const timeoutMs =
      typeof request.timeoutMs === 'number' && Number.isFinite(request.timeoutMs)
        ? Math.max(1000, Math.floor(request.timeoutMs))
        : this.options.defaultTimeoutMs ?? 600_000;

    const cmd = acpCommandForType(this.instance.type);

    const client = new AcpStdioClient({
      command: cmd.command,
      args: cmd.args,
      cwd,
      env: {
        INITIAL_AGENT_MODE: request.mode === 'write' ? 'agent' : 'read-only',
        NO_BROWSER: '1',
      },
      spawnFn: this.options.spawnFn,
      requestTimeoutMs: timeoutMs,
      onAgentRequest: (method) => {
        if (method === 'session/request_permission') {
          return {
            outcome: {
              outcome: 'selected',
              optionId: request.mode === 'write' ? 'allow-once' : 'allow-once',
            },
          };
        }
        return {};
      },
    });

    const sessionKey = request.sessionKey;
    try {
      await client.start();
      await client.initialize();
      const mcpServers = resolveMcpServers({
        userId: this.options.userId,
        memoryBaseUrl: this.options.memoryBaseUrl,
        memoryApiKey: this.options.memoryApiKey,
      });

      let sessionId = '';
      const existingSession =
        typeof request.metadata?.acpSessionId === 'string'
          ? request.metadata.acpSessionId
          : undefined;
      if (existingSession) {
        try {
          await client.loadSession({
            sessionId: existingSession,
            cwd,
            mcpServers,
          });
          sessionId = existingSession;
        } catch {
          sessionId = '';
        }
      }
      if (!sessionId) {
        const created = await client.newSession({ cwd, mcpServers });
        sessionId = created.sessionId;
      }

      const promptText = [
        buildAgentResultSystemPrompt(request, { runtime: 'acp' }),
        '',
        buildAgentResultUserPrompt(request),
        `Action ID: ${request.actionId}`,
      ].join('\n');

      const promptResult = await client.prompt({
        sessionId,
        prompt: [{ type: 'text', text: promptText }],
      });
      const text = extractPromptText(promptResult, client.updates);
      const envelope = parseAgentResultEnvelope(text, {
        targetSystem: request.targetSystem,
        mode: request.mode,
        task: request.task,
        emptySummary: 'ACP 未返回可解析结果',
      });
      return {
        ...envelope,
        remoteRunId: sessionId,
        sessionKey,
        transcript: envelope.transcript || text.slice(0, 4000) || undefined,
        payload: {
          ...(envelope.payload || {}),
          acpSessionId: sessionId,
          stopReason:
            promptResult && typeof promptResult === 'object'
              ? (promptResult as any).stopReason
              : undefined,
          updateCount: client.updates.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/auth|login|unauthorized|401|403/i.test(message)) {
        return {
          status: 'auth_error',
          summary: `ACP 鉴权失败：${message}`,
          artifacts: [],
          sessionKey,
        };
      }
      if (/ENOENT|not found|EACCES|spawn/i.test(message)) {
        return {
          status: 'capability_missing',
          summary: `ACP 执行器不可用：${message}`,
          artifacts: [],
          sessionKey,
        };
      }
      if (/timed out/i.test(message)) {
        return {
          status: 'timeout',
          summary: message,
          artifacts: [],
          sessionKey,
        };
      }
      return {
        status: 'error',
        summary: message,
        artifacts: [],
        sessionKey,
        payload: { error: message },
      };
    } finally {
      client.close();
    }
  }
}
