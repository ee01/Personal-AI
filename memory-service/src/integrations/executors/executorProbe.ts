/**
 * Lightweight executor connectivity probe (no LLM).
 * Stages: dns → connect → auth → ready. Failure names the first failing layer.
 */

import {
  AcpStdioClient,
  defaultCodexAcpCommand,
  type AcpSpawnFn,
} from '../acp/AcpStdioClient.js';
import {
  OpenClawGatewayClient,
  type GatewayWebSocketConstructor,
} from '../openclaw/OpenClawGatewayClient.js';
import type { AgentExecutorInstance } from './executorRegistry.js';
import { isWorkerStale, WORKER_HEARTBEAT_INTERVAL_SECONDS } from '../workers/workerProtocol.js';

export type ProbeStage = 'dns' | 'connect' | 'auth' | 'ready';

export interface ExecutorProbeResult {
  ok: boolean;
  latencyMs: number;
  stage: ProbeStage;
  detail: string;
  nextAction?: string;
  cached?: boolean;
  checkedAt: number;
}

export interface ExecutorProbeDeps {
  fetchFn?: typeof fetch;
  WebSocketImpl?: GatewayWebSocketConstructor;
  spawnFn?: AcpSpawnFn;
  now?: () => number;
  lookupWorkerHeartbeat?: (
    workerId: string,
  ) => Promise<{ lastHeartbeatAt: number | null; status: string; label?: string } | null>;
  enqueueEcho?: (workerId: string) => Promise<{ commandId: string }>;
  waitEcho?: (commandId: string, timeoutMs: number) => Promise<boolean>;
}

const PROBE_TIMEOUT_MS = 8_000;

export function isPrivateOrLoopbackUrl(raw: string | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function classifyNetworkError(error: unknown): Pick<
  ExecutorProbeResult,
  'stage' | 'detail' | 'nextAction'
> {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (
    /enotfound|eai_again|getaddrinfo|dns|err_name_not_resolved/i.test(lower)
  ) {
    return {
      stage: 'dns',
      detail: `DNS 解析失败：${message}`,
      nextAction: '检查 Base URL 主机名是否写对，以及本机 DNS / 代理。',
    };
  }
  if (
    /econnrefused|etimedout|ehostunreach|enetunreach|fetch failed|network|socket|econnreset|aborted/i.test(
      lower,
    )
  ) {
    return {
      stage: 'connect',
      detail: `无法连接：${message}`,
      nextAction: '确认对端进程已启动、端口可从 Memory Service 主机访问。',
    };
  }
  if (/401|403|unauthorized|forbidden|auth|pairing|device/i.test(lower)) {
    return {
      stage: 'auth',
      detail: `鉴权失败：${message}`,
      nextAction: '检查 API Key / Gateway pairing 是否已批准。',
    };
  }
  return {
    stage: 'connect',
    detail: message,
    nextAction: '查看执行器地址与网络后再测一次。',
  };
}

function finish(
  startedAt: number,
  now: number,
  patch: Omit<ExecutorProbeResult, 'latencyMs' | 'checkedAt' | 'cached'>,
): ExecutorProbeResult {
  return {
    ...patch,
    latencyMs: Math.max(0, now - startedAt),
    checkedAt: now,
  };
}

async function probeOpenClawResponses(
  instance: AgentExecutorInstance,
  deps: ExecutorProbeDeps,
  startedAt: number,
  now: () => number,
): Promise<ExecutorProbeResult> {
  const baseUrl = instance.baseUrl?.trim();
  if (!baseUrl) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'dns',
      detail: '未配置 Base URL。',
      nextAction: '在 Options 填写 OpenClaw HTTP 地址后保存再测。',
    });
  }
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'dns',
      detail: `Base URL 无效：${baseUrl}`,
      nextAction: '改成完整 URL，例如 https://host/v1/responses。',
    });
  }

  const fetchFn = deps.fetchFn || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (instance.apiKey?.trim()) {
      headers.Authorization = `Bearer ${instance.apiKey.trim()}`;
      headers['x-api-key'] = instance.apiKey.trim();
    }
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      return finish(startedAt, now(), {
        ok: false,
        stage: 'auth',
        detail: `HTTP ${response.status} 鉴权失败。`,
        nextAction: '检查 API Key 是否正确、是否过期。',
      });
    }
    if (response.status >= 500) {
      return finish(startedAt, now(), {
        ok: false,
        stage: 'connect',
        detail: `HTTP ${response.status} 服务端错误。`,
        nextAction: '查看 OpenClaw HTTP 服务日志。',
      });
    }
    return finish(startedAt, now(), {
      ok: true,
      stage: 'ready',
      detail: `HTTP ${response.status}，探活成功。`,
    });
  } catch (error) {
    const classified = classifyNetworkError(error);
    return finish(startedAt, now(), { ok: false, ...classified });
  } finally {
    clearTimeout(timer);
  }
}

async function probeOpenClawGateway(
  instance: AgentExecutorInstance,
  deps: ExecutorProbeDeps,
  startedAt: number,
  now: () => number,
): Promise<ExecutorProbeResult> {
  const baseUrl = instance.baseUrl?.trim();
  if (!baseUrl) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'dns',
      detail: '未配置 Gateway Base URL。',
      nextAction: '在 Options 填写 Gateway 地址后保存再测。',
    });
  }
  try {
    new URL(baseUrl);
  } catch {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'dns',
      detail: `Base URL 无效：${baseUrl}`,
      nextAction: '改成 ws:// 或 http:// 完整地址。',
    });
  }

  const client = new OpenClawGatewayClient({
    baseUrl,
    apiKey: instance.apiKey,
    requestTimeoutMs: PROBE_TIMEOUT_MS,
    WebSocketImpl: deps.WebSocketImpl,
  });
  try {
    await client.connect();
    return finish(startedAt, now(), {
      ok: true,
      stage: 'ready',
      detail: 'Gateway WebSocket 握手与鉴权成功。',
    });
  } catch (error) {
    const classified = classifyNetworkError(error);
    return finish(startedAt, now(), { ok: false, ...classified });
  } finally {
    client.close();
  }
}

async function probeAcpLocal(
  instance: AgentExecutorInstance,
  deps: ExecutorProbeDeps,
  startedAt: number,
  now: () => number,
): Promise<ExecutorProbeResult> {
  const cmd =
    instance.type === 'acp-claude-code'
      ? {
          command: process.env.ACP_CLAUDE_COMMAND || 'npx',
          args: process.env.ACP_CLAUDE_ARGS
            ? process.env.ACP_CLAUDE_ARGS.split(/\s+/).filter(Boolean)
            : ['-y', '@agentclientprotocol/claude-code-acp'],
        }
      : defaultCodexAcpCommand();
  const missingHint =
    instance.type === 'acp-claude-code'
      ? '请安装 Claude Code ACP（npx @agentclientprotocol/claude-code-acp），并确认 node 在 PATH 中。'
      : '请安装 Codex ACP（npx @agentclientprotocol/codex-acp），并确认 node 在 PATH 中。';

  const client = new AcpStdioClient({
    command: cmd.command,
    args: cmd.args,
    cwd: instance.cwd || process.cwd(),
    spawnFn: deps.spawnFn,
    requestTimeoutMs: PROBE_TIMEOUT_MS,
  });
  try {
    await client.start();
    await client.initialize();
    return finish(startedAt, now(), {
      ok: true,
      stage: 'ready',
      detail: `ACP initialize 握手成功（${cmd.command}）。`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|not found|EACCES|spawn/i.test(message)) {
      return finish(startedAt, now(), {
        ok: false,
        stage: 'connect',
        detail: `ACP 命令不可用：${message}`,
        nextAction: missingHint,
      });
    }
    if (/auth|login|unauthorized|401|403/i.test(message)) {
      return finish(startedAt, now(), {
        ok: false,
        stage: 'auth',
        detail: `ACP 鉴权失败：${message}`,
        nextAction: '在本机完成 Codex / Claude Code 登录后再测。',
      });
    }
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: message,
      nextAction: missingHint,
    });
  } finally {
    client.close();
  }
}

async function probeAcpRemote(
  instance: AgentExecutorInstance,
  deps: ExecutorProbeDeps,
  startedAt: number,
  now: () => number,
  deep: boolean,
): Promise<ExecutorProbeResult> {
  const workerId = instance.workerId?.trim();
  if (!workerId) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: '远程执行器未绑定 Worker。',
      nextAction: '安装 Personal AI Desktop App 并一键配对，或用 headless 一行命令绑定 worker。',
    });
  }
  if (!deps.lookupWorkerHeartbeat) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: 'Worker 查询不可用。',
      nextAction: '重启 Memory Service 后再测。',
    });
  }
  const worker = await deps.lookupWorkerHeartbeat(workerId);
  if (!worker || worker.status === 'revoked') {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: '绑定的 Worker 不存在或已撤销。',
      nextAction: '在 Options 重新配对 Desktop App 或生成新的 pairing token。',
    });
  }
  const heartbeatOk =
    worker.status === 'online' &&
    !isWorkerStale(worker.lastHeartbeatAt, Math.floor(now() / 1000));
  if (!heartbeatOk) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: `Worker 离线（心跳超过 ${WORKER_HEARTBEAT_INTERVAL_SECONDS * 2}s）。`,
      nextAction: '打开 Desktop App / 检查 headless worker 是否在跑。',
    });
  }
  if (!deep) {
    return finish(startedAt, now(), {
      ok: true,
      stage: 'ready',
      detail: `Worker ${worker.label || workerId} 心跳正常。`,
    });
  }
  if (!deps.enqueueEcho || !deps.waitEcho) {
    return finish(startedAt, now(), {
      ok: true,
      stage: 'ready',
      detail: '心跳正常（深度测试不可用）。',
    });
  }
  const { commandId } = await deps.enqueueEcho(workerId);
  const echoed = await deps.waitEcho(commandId, PROBE_TIMEOUT_MS);
  if (!echoed) {
    return finish(startedAt, now(), {
      ok: false,
      stage: 'connect',
      detail: 'Worker 心跳在线，但 echo 深度测试超时。',
      nextAction: '查看 worker 日志；确认 claim/commands 回路通畅。',
    });
  }
  return finish(startedAt, now(), {
    ok: true,
    stage: 'ready',
    detail: 'Worker echo 深度测试成功（未启动 Codex）。',
  });
}

export async function probeExecutor(
  instance: AgentExecutorInstance,
  options: { deep?: boolean } = {},
  deps: ExecutorProbeDeps = {},
): Promise<ExecutorProbeResult> {
  const now = deps.now || Date.now;
  const startedAt = now();
  if (instance.type === 'openclaw-responses') {
    return probeOpenClawResponses(instance, deps, startedAt, now);
  }
  if (instance.type === 'openclaw-gateway') {
    return probeOpenClawGateway(instance, deps, startedAt, now);
  }
  if (instance.type === 'acp-codex' || instance.type === 'acp-claude-code') {
    if (instance.runtime === 'remote') {
      return probeAcpRemote(instance, deps, startedAt, now, options.deep === true);
    }
    return probeAcpLocal(instance, deps, startedAt, now);
  }
  return finish(startedAt, now(), {
    ok: false,
    stage: 'connect',
    detail: `未知执行器类型：${instance.type}`,
  });
}
