/**
 * OpenClaw Gateway executor — agent + agent.wait with sessions.* reconcile.
 */

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
  OpenClawGatewayClient,
  type GatewayWebSocketConstructor,
} from '../openclaw/OpenClawGatewayClient.js';

export type GatewayProgressPatch = {
  status: 'running';
  remoteRunId: string;
  eventCursor?: string;
  sessionKey: string;
  executorType: 'openclaw-gateway';
  executorId: string;
};

function safeJsonCandidateParse(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* try embedded object */
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

function buildDeveloperPrompt(request: AgentSubmitRequest): string {
  return [
    'You are an external delegation agent invoked by Personal AI.',
    `Mode: ${request.mode}`,
    request.targetSystem ? `Target system: ${request.targetSystem}` : undefined,
    'Return JSON only with this envelope:',
    '{"status":"success|capability_missing|auth_error|need_human_decision|error","summary":"...","artifacts":[{"kind":"note","title":"...","content":"...","metadata":{}}],"transcript":"optional compact transcript","payload":{}}',
    'On status=success, artifacts MUST include at least one verifiable artifact.',
    'A verifiable artifact must include content plus metadata.sourceSystem, metadata.entityId or metadata.entityKey, metadata.verification, and metadata.observedFields (read) or metadata.operation / metadata.changedFields (write).',
    'If you cannot provide a verifiable artifact, do not return success.',
    'If required capability/tool is unavailable, use status=capability_missing.',
    'If credentials or permissions are insufficient, use status=auth_error.',
    'If human choice is required before continuing, use status=need_human_decision and include payload.question plus payload.options.',
    'Keep the summary concise and factual.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserPrompt(request: AgentSubmitRequest): string {
  return [
    `Thread ID: ${request.threadId}`,
    request.runId ? `Run ID: ${request.runId}` : undefined,
    request.metadata
      ? `Context metadata: ${JSON.stringify(request.metadata)}`
      : undefined,
    '',
    'Task:',
    request.task,
  ]
    .filter(Boolean)
    .join('\n');
}

function mapStatus(status: string): AgentRunStatus {
  switch (status) {
    case 'success':
    case 'succeeded':
    case 'ok':
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

/** OpenClaw `agent.wait` returns a terminal snapshot, not assistant text. */
function isAgentWaitSnapshot(payload: unknown): payload is {
  status: string;
  error?: unknown;
  startedAt?: number;
  endedAt?: number;
  stopReason?: string;
  runId?: string;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const obj = payload as Record<string, unknown>;
  const status = typeof obj.status === 'string' ? obj.status.trim().toLowerCase() : '';
  if (!status || !['ok', 'error', 'timeout'].includes(status)) return false;
  // Envelope responses use success/capability_missing/… and usually include summary/artifacts.
  if ('artifacts' in obj || 'summary' in obj || 'transcript' in obj) return false;
  const hasWaitShape =
    'startedAt' in obj ||
    'endedAt' in obj ||
    'stopReason' in obj ||
    'error' in obj ||
    Object.keys(obj).every((key) =>
      ['status', 'runId', 'startedAt', 'endedAt', 'stopReason', 'error'].includes(key),
    );
  return hasWaitShape;
}

function messageText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const obj = message as Record<string, unknown>;
  // OpenClaw chat.history uses content: [{ type: 'text', text: '...' }].
  if (Array.isArray(obj.content)) {
    const parts = obj.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const rec = part as Record<string, unknown>;
          if (typeof rec.text === 'string') return rec.text;
          if (typeof rec.content === 'string') return rec.content;
          if (typeof rec.value === 'string') return rec.value;
        }
        return '';
      })
      .filter(Boolean);
    if (parts.length) return parts.join('\n').trim();
  }
  for (const key of ['text', 'content', 'message', 'summary']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function extractAssistantTextFromHistory(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload.trim();
  if (typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  const messages = Array.isArray(obj.messages)
    ? obj.messages
    : Array.isArray(obj.items)
      ? obj.items
      : Array.isArray(obj.entries)
        ? obj.entries
        : Array.isArray(payload)
          ? payload
          : [];

  const assistantTexts: string[] = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i] as Record<string, unknown> | undefined;
    if (!message || typeof message !== 'object') continue;
    const role = String(message.role || message.sender || message.type || '')
      .trim()
      .toLowerCase();
    if (role && !['assistant', 'agent', 'model', 'ai'].includes(role)) continue;
    const text = messageText(message);
    if (!text) continue;
    // Prefer JSON envelopes over reasoning narrations.
    if (text.trimStart().startsWith('{') || text.includes('"status"')) {
      return text;
    }
    assistantTexts.push(text);
  }
  if (assistantTexts.length) return assistantTexts[0];
  return '';
}

function extractText(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);
  if (isAgentWaitSnapshot(payload)) {
    // Wait snapshots are lifecycle metadata; callers must fetch chat.history for text.
    return '';
  }
  const obj = payload as Record<string, unknown>;
  for (const key of ['text', 'message', 'summary', 'output', 'content', 'result']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (Array.isArray(obj.messages) || Array.isArray(obj.items)) {
    const assistant = extractAssistantTextFromHistory(obj);
    if (assistant) return assistant;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

function candidateSessionKeys(sessionKey: string): string[] {
  const key = sessionKey.trim();
  if (!key) return [];
  const keys = [key];
  if (!key.startsWith('agent:')) {
    keys.push(`agent:main:${key}`);
  }
  return [...new Set(keys)];
}

async function fetchAssistantTextFromSession(
  client: OpenClawGatewayClient,
  sessionKey: string,
): Promise<{ text: string; historyPayload?: unknown }> {
  const keys = candidateSessionKeys(sessionKey);
  let resolvedKey = '';
  try {
    const resolved = await client.request<{ key?: string; ok?: boolean }>(
      'sessions.resolve',
      { key: sessionKey },
      8_000,
    );
    if (typeof resolved?.key === 'string' && resolved.key.trim()) {
      resolvedKey = resolved.key.trim();
      keys.unshift(resolvedKey);
    }
  } catch {
    /* optional */
  }

  const tried = [...new Set(keys.filter(Boolean))];
  let lastPayload: unknown;
  for (const key of tried) {
    try {
      const historyPayload = await client.request(
        'chat.history',
        { sessionKey: key, limit: 50 },
        15_000,
      );
      lastPayload = historyPayload;
      const text = extractAssistantTextFromHistory(historyPayload);
      if (text.trim()) {
        return { text, historyPayload };
      }
    } catch {
      /* try next key / method */
    }
    try {
      const preview = await client.request(
        'sessions.preview',
        { keys: [key], limit: 20 },
        10_000,
      );
      lastPayload = preview;
      const text = extractAssistantTextFromHistory(preview);
      if (text.trim()) {
        return { text, historyPayload: preview };
      }
    } catch {
      /* continue */
    }
  }
  return { text: '', historyPayload: lastPayload };
}

async function resolveResultAfterWait(
  client: OpenClawGatewayClient,
  input: {
    waited: unknown;
    remoteRunId: string;
    sessionKey: string;
    targetSystem?: string;
  },
): Promise<AgentResultEnvelope> {
  if (isAgentWaitSnapshot(input.waited)) {
    const waitStatus = String(input.waited.status || '').toLowerCase();
    if (waitStatus === 'timeout') {
      return {
        status: 'timeout',
        summary: `OpenClaw Gateway agent.wait 超时（run ${input.remoteRunId}）`,
        artifacts: [],
        remoteRunId: input.remoteRunId,
        sessionKey: input.sessionKey,
        payload: { gatewayWait: input.waited },
      };
    }
    if (waitStatus === 'error') {
      const err =
        typeof input.waited.error === 'string'
          ? input.waited.error
          : input.waited.error && typeof input.waited.error === 'object'
            ? JSON.stringify(input.waited.error)
            : 'agent.wait returned error';
      return {
        status: 'error',
        summary: err,
        artifacts: [],
        remoteRunId: input.remoteRunId,
        sessionKey: input.sessionKey,
        payload: { gatewayWait: input.waited },
      };
    }
  }

  let historyText = '';
  let historyPayload: unknown;
  if (input.sessionKey) {
    const fetched = await fetchAssistantTextFromSession(
      client,
      input.sessionKey,
    );
    historyText = fetched.text;
    historyPayload = fetched.historyPayload;
  }

  const text = historyText || extractText(input.waited);
  if (!text.trim()) {
    return {
      status: 'error',
      summary:
        'OpenClaw Gateway run 已结束，但未能从 chat.history 读取到助手输出',
      artifacts: [],
      remoteRunId: input.remoteRunId,
      sessionKey: input.sessionKey,
      payload: {
        gatewayWait: input.waited,
        chatHistory: historyPayload,
      },
    };
  }

  const envelope = parseEnvelope(text, input.targetSystem);
  return {
    ...envelope,
    remoteRunId: input.remoteRunId,
    sessionKey: input.sessionKey,
    payload: {
      ...(envelope.payload || {}),
      gatewayWait: input.waited,
      chatHistory: historyPayload,
    },
  };
}

function parseEnvelope(
  text: string,
  targetSystem?: string,
): AgentResultEnvelope {
  const parsed = safeJsonCandidateParse(text);
  if (parsed) {
    const obj = parsed;
    const artifacts = Array.isArray(obj.artifacts)
      ? (obj.artifacts as AgentResultArtifact[])
      : [];
    const statusRaw = String(obj.status || 'error');
    let status = mapStatus(statusRaw);
    if (status === 'succeeded' && !hasVerifiableArtifact(artifacts, { targetSystem })) {
      status = 'error';
      return {
        status,
        summary:
          typeof obj.summary === 'string' && obj.summary.trim()
            ? `${obj.summary.trim()}（缺少可验证 artifact）`
            : 'OpenClaw Gateway 返回了 success，但缺少可验证 artifact。',
        artifacts,
        payload: (obj.payload as Record<string, unknown>) || { raw: obj },
      };
    }
    return {
      status,
      summary:
        typeof obj.summary === 'string' && obj.summary.trim()
          ? obj.summary.trim()
          : text.slice(0, 500),
      artifacts,
      transcript: typeof obj.transcript === 'string' ? obj.transcript : undefined,
      payload: (obj.payload as Record<string, unknown>) || undefined,
    };
  }

  return {
    status: 'error',
    summary: text.slice(0, 500) || 'OpenClaw Gateway 未返回可解析结果',
    artifacts: [],
    payload: { rawText: text },
  };
}

export class OpenClawGatewayExecutor implements AgentExecutor {
  readonly id: string;
  readonly type = 'openclaw-gateway';

  constructor(
    private readonly instance: AgentExecutorInstance,
    private readonly options: {
      onProgress?: (patch: GatewayProgressPatch) => void | Promise<void>;
      WebSocketImpl?: GatewayWebSocketConstructor;
      defaultTimeoutMs?: number;
    } = {},
  ) {
    this.id = instance.id;
  }

  private createClient(timeoutMs?: number): OpenClawGatewayClient {
    if (!this.instance.baseUrl) {
      throw new Error('OpenClaw gateway executor missing baseUrl');
    }
    return new OpenClawGatewayClient({
      baseUrl: this.instance.baseUrl,
      apiKey: this.instance.apiKey,
      WebSocketImpl: this.options.WebSocketImpl,
      requestTimeoutMs: timeoutMs ?? this.options.defaultTimeoutMs ?? 600_000,
    });
  }

  async submit(request: AgentSubmitRequest): Promise<AgentResultEnvelope> {
    const timeoutMs =
      typeof request.timeoutMs === 'number' && Number.isFinite(request.timeoutMs)
        ? Math.max(1000, Math.floor(request.timeoutMs))
        : this.options.defaultTimeoutMs ?? 600_000;
    const client = this.createClient(Math.min(timeoutMs + 30_000, 650_000));
    const sessionKey = request.sessionKey;
    const idempotencyKey = `pai:${request.actionId}`;

    try {
      await client.connect();
      const accepted = await client.request<Record<string, unknown>>(
        'agent',
        {
          message: buildUserPrompt(request),
          extraSystemPrompt: buildDeveloperPrompt(request),
          sessionKey,
          agentId: request.agentId,
          idempotencyKey,
          timeout: Math.ceil(timeoutMs / 1000),
        },
        30_000,
      );

      const remoteRunId = String(
        accepted?.runId || accepted?.id || accepted?.run_id || '',
      ).trim();
      if (!remoteRunId) {
        return {
          status: 'error',
          summary: 'OpenClaw Gateway agent 未返回 runId',
          artifacts: [],
          payload: { accepted },
          sessionKey,
        };
      }

      await this.options.onProgress?.({
        status: 'running',
        remoteRunId,
        sessionKey,
        executorType: 'openclaw-gateway',
        executorId: this.id,
      });

      try {
        const waited = await client.request<unknown>(
          'agent.wait',
          { runId: remoteRunId, timeoutMs },
          timeoutMs + 5_000,
        );
        return await resolveResultAfterWait(client, {
          waited,
          remoteRunId,
          sessionKey,
          targetSystem: request.targetSystem,
        });
      } catch (waitError) {
        return await this.reconcileAfterDisconnect(client, {
          remoteRunId,
          sessionKey,
          targetSystem: request.targetSystem,
          networkError:
            waitError instanceof Error ? waitError.message : String(waitError),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/auth|401|403|token/i.test(message)) {
        return {
          status: 'auth_error',
          summary: `OpenClaw Gateway 鉴权失败：${message}`,
          artifacts: [],
          sessionKey,
        };
      }
      if (/not configured|missing baseUrl|ECONNREFUSED|ENOTFOUND/i.test(message)) {
        return {
          status: 'capability_missing',
          summary: `OpenClaw Gateway 不可用：${message}`,
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

  async poll(
    remoteRunId: string,
    cursor?: string,
  ): Promise<AgentResultEnvelope> {
    const client = this.createClient(30_000);
    try {
      await client.connect();
      return await this.reconcileAfterDisconnect(client, {
        remoteRunId,
        sessionKey: '',
        eventCursor: cursor,
        networkError: 'poll',
      });
    } finally {
      client.close();
    }
  }

  async cancel(remoteRunId: string): Promise<AgentResultEnvelope> {
    const client = this.createClient(15_000);
    try {
      await client.connect();
      await client.request('sessions.abort', { runId: remoteRunId }, 15_000);
      return {
        status: 'cancelled',
        summary: `已取消 OpenClaw Gateway run ${remoteRunId}`,
        artifacts: [],
        remoteRunId,
      };
    } catch (error) {
      return {
        status: 'error',
        summary:
          error instanceof Error
            ? error.message
            : `取消 Gateway run 失败：${String(error)}`,
        artifacts: [],
        remoteRunId,
      };
    } finally {
      client.close();
    }
  }

  private async reconcileAfterDisconnect(
    client: OpenClawGatewayClient,
    input: {
      remoteRunId: string;
      sessionKey: string;
      targetSystem?: string;
      eventCursor?: string;
      networkError: string;
    },
  ): Promise<AgentResultEnvelope> {
    try {
      // Prefer waiting again briefly — gateway may still hold the run.
      try {
        const waited = await client.request<unknown>(
          'agent.wait',
          { runId: input.remoteRunId, timeoutMs: 5_000 },
          8_000,
        );
        const resolved = await resolveResultAfterWait(client, {
          waited,
          remoteRunId: input.remoteRunId,
          sessionKey: input.sessionKey,
          targetSystem: input.targetSystem,
        });
        const historyMiss =
          isAgentWaitSnapshot(waited) &&
          String(waited.status).toLowerCase() === 'ok' &&
          resolved.status === 'error' &&
          /未能从 chat\.history/.test(resolved.summary || '');
        if (!historyMiss) {
          return {
            ...resolved,
            eventCursor: input.eventCursor,
            payload: {
              ...(resolved.payload || {}),
              reconciled: true,
              networkError: input.networkError,
            },
          };
        }
      } catch {
        /* fall through to sessions.* */
      }

      let sessionPayload: unknown;
      try {
        sessionPayload = await client.request(
          'sessions.get',
          input.sessionKey
            ? { key: input.sessionKey }
            : { runId: input.remoteRunId },
          10_000,
        );
      } catch {
        sessionPayload = await client.request(
          'sessions.list',
          {},
          10_000,
        );
      }

      const text = extractText(sessionPayload).toLowerCase();
      const stillRunning =
        /running|in_progress|active|pending|queued/.test(text) ||
        (sessionPayload &&
          typeof sessionPayload === 'object' &&
          /running|active|in_progress/i.test(
            JSON.stringify(sessionPayload),
          ));

      if (stillRunning) {
        return {
          status: 'running',
          summary: `Gateway 连接中断，但 remote run ${input.remoteRunId} 仍在执行；已保留以便后续 reconcile。`,
          artifacts: [],
          remoteRunId: input.remoteRunId,
          sessionKey: input.sessionKey,
          eventCursor: input.eventCursor,
          payload: {
            reconciled: true,
            stillRunning: true,
            networkError: input.networkError,
            session: sessionPayload,
          },
        };
      }

      const missing =
        !sessionPayload ||
        /not found|unknown|missing|no such/i.test(JSON.stringify(sessionPayload));
      if (missing) {
        return {
          status: 'failed',
          summary: `Gateway 连接中断，且找不到 remote run ${input.remoteRunId}（${input.networkError}）`,
          artifacts: [],
          remoteRunId: input.remoteRunId,
          sessionKey: input.sessionKey,
          payload: {
            reconciled: true,
            missing: true,
            networkError: input.networkError,
          },
        };
      }

      // Session exists but not clearly running — treat as recoverable.
      return {
        status: 'input_required',
        summary: `Gateway 连接中断；remote run ${input.remoteRunId} 状态不明确，需稍后 reconcile。`,
        artifacts: [],
        remoteRunId: input.remoteRunId,
        sessionKey: input.sessionKey,
        eventCursor: input.eventCursor,
        payload: {
          reconciled: true,
          ambiguous: true,
          networkError: input.networkError,
          session: sessionPayload,
        },
      };
    } catch (error) {
      return {
        status: 'input_required',
        summary: `Gateway 连接中断且 reconcile 失败（保留 remote run ${input.remoteRunId}）：${
          error instanceof Error ? error.message : String(error)
        }`,
        artifacts: [],
        remoteRunId: input.remoteRunId,
        sessionKey: input.sessionKey,
        eventCursor: input.eventCursor,
        payload: {
          reconciled: false,
          networkError: input.networkError,
          reconcileError:
            error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
