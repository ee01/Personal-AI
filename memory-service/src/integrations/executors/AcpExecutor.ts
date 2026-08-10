/**
 * AcpExecutor — drives @agentclientprotocol/codex-acp (or compatible) over stdio.
 * Injects Personal AI memory MCP for on-demand recall (no memory DB copy).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  AgentExecutor,
  AgentResultEnvelope,
  AgentRunStatus,
  AgentSubmitRequest,
} from './AgentExecutor.js';
import {
  hasVerifiableArtifact,
  type AgentResultArtifact,
} from './agentResultContract.js';
import type { AgentExecutorInstance } from './executorRegistry.js';
import {
  AcpStdioClient,
  defaultCodexAcpCommand,
  type AcpMcpServerConfig,
  type AcpSpawnFn,
} from '../acp/AcpStdioClient.js';
import { getConfig } from '../../config.js';

function safeJsonCandidateParse(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* try embedded */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function mapStatus(status: string): AgentRunStatus {
  switch (status) {
    case 'success':
    case 'succeeded':
      return 'succeeded';
    case 'capability_missing':
      return 'capability_missing';
    case 'auth_error':
      return 'auth_error';
    case 'need_human_decision':
      return 'need_human_decision';
    case 'timeout':
      return 'timeout';
    case 'cancelled':
      return 'cancelled';
    case 'running':
      return 'running';
    case 'input_required':
      return 'input_required';
    default:
      return 'failed';
  }
}

function buildDeveloperPrompt(request: AgentSubmitRequest): string {
  return [
    'You are Codex invoked by Personal AI via ACP for code / repo evidence tasks.',
    `Mode: ${request.mode}`,
    request.targetSystem ? `Target system: ${request.targetSystem}` : undefined,
    'Prefer local filesystem, git history, tests, and CLI-reachable systems.',
    'Use the personal-memory MCP tools when you need prior Personal AI memory; do not invent memory.',
    'Return JSON only with this envelope:',
    '{"status":"success|capability_missing|auth_error|need_human_decision|error","summary":"...","artifacts":[{"kind":"note","title":"...","content":"...","metadata":{}}],"transcript":"optional","payload":{}}',
    'On status=success, artifacts MUST include at least one verifiable artifact with metadata.sourceSystem, entityId/entityKey, verification, and observedFields or operation/changedFields.',
  ]
    .filter(Boolean)
    .join('\n');
}

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

function parseEnvelope(
  text: string,
  targetSystem?: string,
): AgentResultEnvelope {
  const parsed = safeJsonCandidateParse(text);
  if (parsed) {
    const artifacts = Array.isArray(parsed.artifacts)
      ? (parsed.artifacts as AgentResultArtifact[])
      : [];
    let status = mapStatus(String(parsed.status || 'error'));
    if (status === 'succeeded' && !hasVerifiableArtifact(artifacts, { targetSystem })) {
      return {
        status: 'error',
        summary:
          typeof parsed.summary === 'string' && parsed.summary.trim()
            ? `${parsed.summary.trim()}（缺少可验证 artifact）`
            : 'ACP 返回了 success，但缺少可验证 artifact。',
        artifacts,
        payload: (parsed.payload as Record<string, unknown>) || { raw: parsed },
      };
    }
    return {
      status,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : text.slice(0, 500),
      artifacts,
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript : undefined,
      payload: (parsed.payload as Record<string, unknown>) || undefined,
    };
  }

  if (text.trim()) {
    // Soft success path for free-form code answers: wrap as note artifact when mode is research-like.
    return {
      status: 'error',
      summary: text.slice(0, 500),
      artifacts: [],
      payload: { rawText: text },
    };
  }

  return {
    status: 'error',
    summary: 'ACP 未返回可解析结果',
    artifacts: [],
  };
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

    const cmd =
      this.instance.type === 'acp-claude-code'
        ? {
            command: process.env.ACP_CLAUDE_COMMAND || 'npx',
            args: process.env.ACP_CLAUDE_ARGS
              ? process.env.ACP_CLAUDE_ARGS.split(/\s+/).filter(Boolean)
              : ['-y', '@agentclientprotocol/claude-code-acp'],
          }
        : defaultCodexAcpCommand();

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
        buildDeveloperPrompt(request),
        '',
        `Thread ID: ${request.threadId}`,
        request.runId ? `Run ID: ${request.runId}` : undefined,
        `Action ID: ${request.actionId}`,
        '',
        'Task:',
        request.task,
      ]
        .filter(Boolean)
        .join('\n');

      const promptResult = await client.prompt({
        sessionId,
        prompt: [{ type: 'text', text: promptText }],
      });
      const text = extractPromptText(promptResult, client.updates);
      const envelope = parseEnvelope(text, request.targetSystem);
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
