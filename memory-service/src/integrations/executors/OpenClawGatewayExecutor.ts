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

function extractText(payload: unknown): string {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return String(payload);
  const obj = payload as Record<string, unknown>;
  for (const key of ['text', 'message', 'summary', 'output', 'content', 'result']) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (Array.isArray(obj.messages)) {
    const last = obj.messages[obj.messages.length - 1] as
      | { content?: string; text?: string }
      | undefined;
    if (typeof last?.content === 'string') return last.content;
    if (typeof last?.text === 'string') return last.text;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
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
        const text = extractText(waited);
        const envelope = parseEnvelope(text, request.targetSystem);
        return {
          ...envelope,
          remoteRunId,
          sessionKey,
          payload: {
            ...(envelope.payload || {}),
            gatewayWait: waited,
          },
        };
      } catch (waitError) {
        return this.reconcileAfterDisconnect(client, {
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
      return this.reconcileAfterDisconnect(client, {
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
        const text = extractText(waited);
        if (text.trim()) {
          const envelope = parseEnvelope(text, input.targetSystem);
          return {
            ...envelope,
            remoteRunId: input.remoteRunId,
            sessionKey: input.sessionKey,
            eventCursor: input.eventCursor,
            payload: {
              ...(envelope.payload || {}),
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
