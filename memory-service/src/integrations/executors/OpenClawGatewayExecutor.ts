/**
 * OpenClaw Gateway executor — agent + agent.wait with sessions.* reconcile.
 */

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
  GATEWAY_RUN_CONFIRM_INTERVALS_MS,
  defaultGatewayConfirmSleep,
  isAgentRunTerminalStatus,
  isWaitRpcTimeout,
  shouldContinueWaiting,
} from './gatewayRunConfirm.js';
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

  // OpenClaw protocol v3 can return session previews rather than a direct
  // message list: { previews: [{ key, items: [...] }] }. Flatten those
  // preview items so a completed run with a legitimate terse response (for
  // example NO_REPLY) is not incorrectly reported as a history-read failure.
  if (!messages.length && Array.isArray(obj.previews)) {
    for (let i = obj.previews.length - 1; i >= 0; i -= 1) {
      const preview = obj.previews[i] as Record<string, unknown> | undefined;
      if (!preview || typeof preview !== 'object') continue;
      const text = extractAssistantTextFromHistory(preview.items);
      if (text) return text;
    }
  }

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
    mode?: 'read' | 'write';
    task?: string;
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

  const envelope = parseAgentResultEnvelope(text, {
    targetSystem: input.targetSystem,
    mode: input.mode,
    task: input.task,
    emptySummary: 'OpenClaw Gateway 未返回可解析结果',
  });
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

export class OpenClawGatewayExecutor implements AgentExecutor {
  readonly id: string;
  readonly type = 'openclaw-gateway';

  constructor(
    private readonly instance: AgentExecutorInstance,
    private readonly options: {
      onProgress?: (patch: GatewayProgressPatch) => void | Promise<void>;
      WebSocketImpl?: GatewayWebSocketConstructor;
      defaultTimeoutMs?: number;
      confirmIntervalsMs?: readonly number[];
      sleep?: (ms: number) => Promise<void>;
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
    const idempotencyKey = request.idempotencyKey || `pai:${request.actionId}`;

    try {
      await client.connect();
      const accepted = await client.request<Record<string, unknown>>(
        'agent',
        {
          message: buildAgentResultUserPrompt(request),
          extraSystemPrompt: buildAgentResultSystemPrompt(request, {
            runtime: 'openclaw',
          }),
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
        const resolved = await resolveResultAfterWait(client, {
          waited,
          remoteRunId,
          sessionKey,
          targetSystem: request.targetSystem,
          mode: request.mode,
          task: request.task,
        });
        if (resolved.status === 'timeout') {
          return await this.confirmRemoteRun(client, {
            remoteRunId,
            sessionKey,
            targetSystem: request.targetSystem,
            mode: request.mode,
            task: request.task,
            networkError: resolved.summary,
          });
        }
        return resolved;
      } catch (waitError) {
        const networkError =
          waitError instanceof Error ? waitError.message : String(waitError);
        if (isWaitRpcTimeout(waitError)) {
          return await this.confirmRemoteRun(client, {
            remoteRunId,
            sessionKey,
            targetSystem: request.targetSystem,
            mode: request.mode,
            task: request.task,
            networkError,
          });
        }
        return await this.reconcileAfterDisconnect(client, {
          remoteRunId,
          sessionKey,
          targetSystem: request.targetSystem,
          mode: request.mode,
          task: request.task,
          networkError,
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
    context?: {
      sessionKey?: string;
      targetSystem?: string;
      mode?: 'read' | 'write';
      task?: string;
    },
  ): Promise<AgentResultEnvelope> {
    const client = this.createClient(30_000);
    try {
      await client.connect();
      return await this.reconcileAfterDisconnect(client, {
        remoteRunId,
        sessionKey: context?.sessionKey || '',
        targetSystem: context?.targetSystem,
        mode: context?.mode,
        task: context?.task,
        eventCursor: cursor,
        networkError: 'poll',
      });
    } finally {
      client.close();
    }
  }

  private confirmIntervals(): readonly number[] {
    const configured = this.options.confirmIntervalsMs;
    if (configured && configured.length > 0) return configured;
    return GATEWAY_RUN_CONFIRM_INTERVALS_MS;
  }

  private async confirmRemoteRun(
    client: OpenClawGatewayClient,
    input: {
      remoteRunId: string;
      sessionKey: string;
      targetSystem?: string;
      mode?: 'read' | 'write';
      task?: string;
      networkError: string;
    },
  ): Promise<AgentResultEnvelope> {
    const intervals = this.confirmIntervals();
    const sleep = this.options.sleep ?? defaultGatewayConfirmSleep;
    let last: AgentResultEnvelope | undefined;
    let inconclusive = 0;

    for (let index = 0; index < intervals.length; index += 1) {
      await sleep(intervals[index] ?? 0);
      last = await this.reconcileAfterDisconnect(client, {
        ...input,
        networkError: `confirm:${index + 1}:${input.networkError}`,
      });
      const annotated = this.annotateConfirm(last, {
        attempt: index + 1,
        attempts: intervals.length,
        inconclusive,
        networkError: input.networkError,
      });
      if (isAgentRunTerminalStatus(annotated.status)) {
        return annotated;
      }
      if (shouldContinueWaiting(annotated.status)) {
        last = annotated;
        continue;
      }
      inconclusive += 1;
      last = annotated;
    }

    if (last && shouldContinueWaiting(last.status)) {
      return {
        ...last,
        status: 'running',
        summary:
          last.status === 'running'
            ? last.summary
            : `agent.wait 已超时，但 remote run ${input.remoteRunId} 在 ${intervals.length} 次确认中仍在执行；保持 running 以便后续对账。`,
        payload: {
          ...(last.payload || {}),
          confirmedRunning: true,
          confirmAttempts: intervals.length,
          confirmInconclusive: inconclusive,
        },
      };
    }

    return {
      status: 'timeout',
      summary: `OpenClaw Gateway remote run ${input.remoteRunId} 在 ${intervals.length} 次状态确认后仍无法对上最终结果`,
      artifacts: [],
      remoteRunId: input.remoteRunId,
      sessionKey: input.sessionKey,
      payload: {
        confirmAttempts: intervals.length,
        confirmInconclusive: inconclusive,
        lastStatus: last?.status,
        networkError: input.networkError,
        lastPayload: last?.payload,
      },
    };
  }

  private annotateConfirm(
    envelope: AgentResultEnvelope,
    input: {
      attempt: number;
      attempts: number;
      inconclusive: number;
      networkError: string;
    },
  ): AgentResultEnvelope {
    return {
      ...envelope,
      payload: {
        ...(envelope.payload || {}),
        confirmAttempt: input.attempt,
        confirmAttempts: input.attempts,
        confirmInconclusive: input.inconclusive,
        confirmNetworkError: input.networkError,
      },
    };
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
      mode?: 'read' | 'write';
      task?: string;
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
          mode: input.mode,
          task: input.task,
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
