import { MulticaClient, type MulticaAgent, type MulticaProject, type MulticaRuntime, type MulticaWorkspace } from './multicaClient.js';
import {
  OFFICIAL_MULTICA_API_ORIGIN,
  OFFICIAL_MULTICA_WEB_ORIGIN,
  assertHttpsOrigin,
} from './multicaContract.js';

export const MULTICA_SESSION_KEY = 'multicaConnectionSession';
export const MULTICA_LOCAL_KEY = 'multicaConnectionRemembered';
export const MULTICA_CAPABILITY_KEY = 'multicaSchedulerCapability';
export const MULTICA_RULE_STAMP_KEY = 'multicaSchedulerRuleStamp';

export interface StoredMulticaConnection {
  apiOrigin: string;
  webOrigin: string;
  pat: string;
  userId: string;
  accountLabel: string;
  workspaceId: string;
  workspaceSlug: string;
  allowedWorkspaceIds: string[];
  remember: boolean;
}

export interface PublicMulticaConnection {
  connected: boolean;
  apiOrigin: string;
  webOrigin: string;
  userId: string;
  accountLabel: string;
  workspaceId: string;
  workspaceSlug: string;
  remember: boolean;
}

export interface KeyValueStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export function toPublicConnection(stored: StoredMulticaConnection | null): PublicMulticaConnection {
  if (!stored?.pat || !stored.userId) {
    return {
      connected: false,
      apiOrigin: OFFICIAL_MULTICA_API_ORIGIN,
      webOrigin: OFFICIAL_MULTICA_WEB_ORIGIN,
      userId: '',
      accountLabel: '',
      workspaceId: '',
      workspaceSlug: '',
      remember: false,
    };
  }
  return {
    connected: true,
    apiOrigin: stored.apiOrigin,
    webOrigin: stored.webOrigin,
    userId: stored.userId,
    accountLabel: stored.accountLabel,
    workspaceId: stored.workspaceId,
    workspaceSlug: stored.workspaceSlug,
    remember: stored.remember,
  };
}

export function isTrustedMulticaSender(
  sender: { id?: string; url?: string } | null | undefined,
  extensionId: string,
): boolean {
  if (!sender?.id || !extensionId || sender.id !== extensionId) return false;
  try {
    const url = new URL(sender.url || '');
    return url.protocol === 'chrome-extension:'
      && url.host === extensionId
      && (url.pathname === '/scheduled-messages.html' || url.pathname === '/options.html');
  } catch {
    return false;
  }
}

export async function loadStoredConnection(
  session: KeyValueStorage,
  local: KeyValueStorage,
): Promise<StoredMulticaConnection | null> {
  const sessionValue = await session.get([MULTICA_SESSION_KEY]);
  const fromSession = readStored(sessionValue[MULTICA_SESSION_KEY]);
  if (fromSession) return fromSession;
  const localValue = await local.get([MULTICA_LOCAL_KEY]);
  return readStored(localValue[MULTICA_LOCAL_KEY]);
}

export async function saveStoredConnection(
  session: KeyValueStorage,
  local: KeyValueStorage,
  connection: StoredMulticaConnection,
): Promise<void> {
  if (connection.remember) {
    await local.set({ [MULTICA_LOCAL_KEY]: connection });
    await session.remove([MULTICA_SESSION_KEY]);
    return;
  }
  await session.set({ [MULTICA_SESSION_KEY]: connection });
  await local.remove([MULTICA_LOCAL_KEY]);
}

export async function clearStoredConnection(session: KeyValueStorage, local: KeyValueStorage): Promise<void> {
  await session.remove([MULTICA_SESSION_KEY]);
  await local.remove([MULTICA_LOCAL_KEY]);
}

export async function ensureSchedulerCapability(local: KeyValueStorage): Promise<string> {
  const current = await local.get([MULTICA_CAPABILITY_KEY]);
  const existing = typeof current[MULTICA_CAPABILITY_KEY] === 'string'
    ? current[MULTICA_CAPABILITY_KEY] as string
    : '';
  if (/^[a-f0-9]{64}$/.test(existing)) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const created = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await local.set({ [MULTICA_CAPABILITY_KEY]: created });
  return created;
}

function readStored(value: unknown): StoredMulticaConnection | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StoredMulticaConnection>;
  if (typeof record.pat !== 'string' || typeof record.userId !== 'string') return null;
  return {
    apiOrigin: record.apiOrigin || OFFICIAL_MULTICA_API_ORIGIN,
    webOrigin: record.webOrigin || OFFICIAL_MULTICA_WEB_ORIGIN,
    pat: record.pat,
    userId: record.userId,
    accountLabel: record.accountLabel || record.userId,
    workspaceId: record.workspaceId || '',
    workspaceSlug: record.workspaceSlug || '',
    allowedWorkspaceIds: Array.isArray(record.allowedWorkspaceIds) ? record.allowedWorkspaceIds : [],
    remember: record.remember === true,
  };
}

export interface MulticaHandlerResult {
  success: boolean;
  error?: string;
  code?: string;
  connection?: PublicMulticaConnection;
  workspaces?: MulticaWorkspace[];
  agents?: MulticaAgent[];
  projects?: MulticaProject[];
  runtimes?: MulticaRuntime[];
  autopilot?: { id: string; description?: string; triggers?: unknown[] };
  autopilots?: Array<{ id: string; description: string; title: string }>;
  trigger?: { id: string; webhookUrl: string; webhookPath: string };
  remotePlansStopped?: boolean;
  message?: string;
}

export async function handleMulticaExtensionMessage(
  request: { type?: string; data?: Record<string, unknown> },
  sender: { id?: string; url?: string } | undefined,
  deps: {
    extensionId: string;
    session: KeyValueStorage;
    local: KeyValueStorage;
    clientFactory?: (connection: StoredMulticaConnection) => MulticaClient;
  },
): Promise<MulticaHandlerResult> {
  if (!isTrustedMulticaSender(sender, deps.extensionId)) {
    return { success: false, error: '只有定时消息管理页可以调用 Multica', code: 'sender_rejected' };
  }
  const type = request.type || '';
  const data = request.data || {};
  try {
    if (type === 'MULTICA_STATUS') {
      return { success: true, connection: toPublicConnection(await loadStoredConnection(deps.session, deps.local)) };
    }
    if (type === 'MULTICA_DISCONNECT') {
      await clearStoredConnection(deps.session, deps.local);
      return {
        success: true,
        connection: toPublicConnection(null),
        remotePlansStopped: false,
        message: '已删除本机 PAT。已经接好的周期任务和 Webhook 不会因此停止。',
      };
    }
    if (type === 'MULTICA_VERIFY') {
      const pat = String(data.pat || '');
      const apiOrigin = assertHttpsOrigin(String(data.apiOrigin || OFFICIAL_MULTICA_API_ORIGIN), 'API 地址');
      const webOrigin = assertHttpsOrigin(String(data.webOrigin || OFFICIAL_MULTICA_WEB_ORIGIN), '网页地址');
      const probing = deps.clientFactory
        ? deps.clientFactory({
          apiOrigin, webOrigin, pat, userId: '', accountLabel: '', workspaceId: '', workspaceSlug: '',
          allowedWorkspaceIds: [], remember: data.remember === true,
        })
        : new MulticaClient({ apiOrigin, pat });
      const account = await probing.getMe();
      const workspaces = await probing.listWorkspaces();
      const connection: StoredMulticaConnection = {
        apiOrigin,
        webOrigin,
        pat,
        userId: account.id,
        accountLabel: account.label,
        workspaceId: '',
        workspaceSlug: '',
        allowedWorkspaceIds: workspaces.map((item) => item.id),
        remember: data.remember === true,
      };
      await saveStoredConnection(deps.session, deps.local, connection);
      return { success: true, connection: toPublicConnection(connection), workspaces };
    }
    const stored = await loadStoredConnection(deps.session, deps.local);
    if (!stored) return { success: false, error: '尚未验证 Multica 连接', code: 'not_connected' };
    if (type === 'MULTICA_SET_REMEMBER') {
      const next = { ...stored, remember: data.remember === true };
      await saveStoredConnection(deps.session, deps.local, next);
      return { success: true, connection: toPublicConnection(next) };
    }
    if (type === 'MULTICA_SELECT_WORKSPACE') {
      const workspaceId = String(data.workspaceId || '');
      if (!stored.allowedWorkspaceIds.includes(workspaceId)) {
        return { success: false, error: '这个 workspace 不在当前 PAT 可访问的列表里', code: 'workspace_rejected' };
      }
      const next = {
        ...stored,
        workspaceId,
        workspaceSlug: String(data.workspaceSlug || ''),
      };
      await saveStoredConnection(deps.session, deps.local, next);
      return { success: true, connection: toPublicConnection(next) };
    }
    if (!stored.workspaceId) {
      return { success: false, error: '请先选择 workspace', code: 'missing_workspace' };
    }
    const client = deps.clientFactory
      ? deps.clientFactory(stored)
      : new MulticaClient({ apiOrigin: stored.apiOrigin, pat: stored.pat, workspaceId: stored.workspaceId });
    if (type === 'MULTICA_LIST_RESOURCES') {
      const [agents, projects, runtimes] = await Promise.all([
        client.listAgents(),
        client.listProjects(),
        client.listRuntimes(),
      ]);
      return { success: true, agents, projects, runtimes, connection: toPublicConnection(stored) };
    }
    if (type === 'MULTICA_LIST_AUTOPILOTS') {
      const autopilots = await client.listAutopilots();
      return {
        success: true,
        autopilots: autopilots.map((item) => ({ id: item.id, description: item.description, title: item.title })),
      };
    }
    if (type === 'MULTICA_GET_AUTOPILOT') {
      const autopilot = await client.getAutopilot(String(data.autopilotId || ''));
      return { success: true, autopilot };
    }
    if (type === 'MULTICA_CREATE_AUTOPILOT') {
      const autopilot = await client.createAutopilot({
        title: String(data.title || ''),
        description: String(data.description || ''),
        agentId: String(data.agentId || ''),
        projectId: String(data.projectId || '') || undefined,
      });
      return { success: true, autopilot };
    }
    if (type === 'MULTICA_PATCH_AUTOPILOT') {
      const autopilot = await client.patchAutopilot(String(data.autopilotId || ''), {
        description: String(data.description || ''),
        agentId: String(data.agentId || ''),
        projectId: String(data.projectId || '') || undefined,
      });
      return { success: true, autopilot };
    }
    if (type === 'MULTICA_CREATE_WEBHOOK') {
      const trigger = await client.createWebhook(String(data.autopilotId || ''), String(data.label || ''));
      return {
        success: true,
        trigger: { id: trigger.id, webhookUrl: trigger.webhookUrl, webhookPath: trigger.webhookPath },
      };
    }
    if (type === 'MULTICA_PATCH_TRIGGER') {
      await client.patchTrigger(String(data.autopilotId || ''), String(data.triggerId || ''), data.enabled === true);
      return { success: true };
    }
    if (type === 'MULTICA_ARCHIVE') {
      await client.archiveAutopilot(String(data.autopilotId || ''));
      return { success: true, remotePlansStopped: true };
    }
    return { success: false, error: '不支持的 Multica 操作', code: 'operation_rejected' };
  } catch (error) {
    return { success: false, error: failureMessage(error), code: 'request_failed' };
  }
}

function failureMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim();
    if (message && message !== '[object Object]') return message;
  }
  return 'Multica 请求失败';
}

export function sendMulticaExtensionMessage(
  type: string,
  data?: Record<string, unknown>,
): Promise<MulticaHandlerResult> {
  return new Promise((resolve, reject) => {
    const runtime = (globalThis as { chrome?: { runtime?: {
      lastError?: { message?: string };
      sendMessage: (message: unknown, callback: (response: MulticaHandlerResult) => void) => void;
    } } }).chrome?.runtime;
    if (!runtime?.sendMessage) {
      reject(new Error('当前页面不能调用扩展后台'));
      return;
    }
    runtime.sendMessage({ type, data }, (response) => {
      const runtimeError = runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || '扩展后台没有响应。请在 chrome://extensions 重新加载 Personal AI 后再试。'));
        return;
      }
      if (!response) {
        reject(new Error('扩展后台没有响应。请在 chrome://extensions 重新加载 Personal AI 后再试。'));
        return;
      }
      if (!response.success) {
        reject(new Error(response.error || 'Multica 没有返回失败原因'));
        return;
      }
      resolve(response);
    });
  });
}
