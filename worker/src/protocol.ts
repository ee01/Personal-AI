import { detectCursorAgentBinary } from './cursorCommand.js';

export const WORKER_PROTOCOL_VERSION = 1;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const CLAIM_INTERVAL_MS = 5_000;

export type WorkerHostKind = 'desktop' | 'headless';

export interface WorkerState {
  serverUrl: string;
  credential?: string;
  workerId?: string;
  pairingToken?: string;
  hostKind: WorkerHostKind;
  hostname: string;
}

export interface ClaimedTask {
  actionId: string;
  fenceToken: number;
  leaseUntil: number;
  executor?: {
    id?: string;
    type?: string;
    cwd?: string;
  };
  request?: {
    task?: string;
    mode?: string;
    actionId?: string;
    timeoutMs?: number;
    targetSystem?: string;
  };
  memory?: {
    mcpUrl?: string;
    userId?: string;
  };
}

export async function memoryRequest<T>(
  state: WorkerState,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(path, state.serverUrl.endsWith('/') ? state.serverUrl : `${state.serverUrl}/`);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = state.credential || state.pairingToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const err = data as { error?: string; message?: string };
    throw new Error(err.message || err.error || `HTTP ${response.status} ${path}`);
  }
  return data as T;
}

export async function pairWorker(state: WorkerState): Promise<WorkerState> {
  if (!state.pairingToken) {
    throw new Error('pairing token required');
  }
  const result = await memoryRequest<{
    workerId: string;
    credential: string;
  }>(state, 'POST', '/api/v1/agent-workers/pair', {
    pairingToken: state.pairingToken,
    protocolVersion: WORKER_PROTOCOL_VERSION,
    hostKind: state.hostKind,
    hostname: state.hostname,
    capabilities: {
      echo: true,
      acpCodex: true,
      acpClaudeCode: true,
      acpCursor: Boolean(
        process.env.CURSOR_AGENT_COMMAND ||
          process.env.ACP_CURSOR_COMMAND ||
          detectCursorAgentBinary(),
      ),
    },
  });
  return {
    ...state,
    workerId: result.workerId,
    credential: result.credential,
    pairingToken: undefined,
  };
}

export async function heartbeat(state: WorkerState, currentTaskCount: number) {
  if (!state.workerId) throw new Error('not paired');
  return memoryRequest<{
    ok: boolean;
    commands?: Array<{ id: string; kind: string; payload?: Record<string, unknown> }>;
  }>(state, 'POST', `/api/v1/agent-workers/${state.workerId}/heartbeat`, {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    currentTaskCount,
    hostname: state.hostname,
  });
}

export async function claim(state: WorkerState, maxItems = 1) {
  if (!state.workerId) throw new Error('not paired');
  return memoryRequest<{ tasks: ClaimedTask[] }>(
    state,
    'POST',
    `/api/v1/agent-workers/${state.workerId}/claim`,
    { maxItems },
  );
}

export async function report(
  state: WorkerState,
  body: Record<string, unknown>,
) {
  if (!state.workerId) throw new Error('not paired');
  return memoryRequest(
    state,
    'POST',
    `/api/v1/agent-workers/${state.workerId}/report`,
    body,
  );
}
