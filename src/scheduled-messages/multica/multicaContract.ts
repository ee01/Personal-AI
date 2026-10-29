export const OFFICIAL_MULTICA_API_ORIGIN = 'https://api.multica.ai';
export const OFFICIAL_MULTICA_WEB_ORIGIN = 'https://multica.ai';
export const MULTICA_WEBHOOK_PATH_PREFIX = '/api/webhooks/autopilots/';
export const MULTICA_BINDING_MARKER_PREFIX = 'PAI_BINDING:';
export const MULTICA_IDEMPOTENCY_LIMIT = 128;
export const MULTICA_PROVIDER = 'multica';
export const LEGACY_AGENT_PROVIDER = 'legacy_memory';

export type ProvisionState =
  | 'draft'
  | 'sheet_paused'
  | 'autopilot_created'
  | 'webhook_created'
  | 'binding_written'
  | 'ready'
  | 'needs_reconnect'
  | 'pending_confirmation';

export interface PublicMulticaFields {
  Agent_Provider: 'multica';
  Agent_Binding_ID: string;
  Agent_Multica_Workspace_ID: string;
  Agent_Multica_Workspace_Slug: string;
  Agent_Multica_Agent_ID: string;
  Agent_Multica_Project_ID: string;
  Agent_Multica_Autopilot_ID: string;
  Agent_Multica_Trigger_ID: string;
  Agent_Multica_Web_Origin: string;
  Agent_Multica_Api_Origin: string;
  Agent_Multica_User_ID: string;
  Agent_Provision_State: ProvisionState;
  Agent_Content_Revision: string;
}

export interface MulticaBindingRecord {
  bindingUuid: string;
  messageId: string;
  apiOrigin: string;
  webAppOrigin: string;
  multicaUserId: string;
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  projectId: string;
  autopilotId: string;
  triggerId: string;
  contentRevision: string;
  provisionState: ProvisionState;
  webhookUrl: string;
  createdByConnection: string;
  remoteUpdatedAt: string;
  spreadsheetId: string;
}

export const MULTICA_BINDING_HEADERS: Array<keyof MulticaBindingRecord> = [
  'bindingUuid',
  'messageId',
  'apiOrigin',
  'webAppOrigin',
  'multicaUserId',
  'workspaceId',
  'workspaceSlug',
  'agentId',
  'projectId',
  'autopilotId',
  'triggerId',
  'contentRevision',
  'provisionState',
  'webhookUrl',
  'createdByConnection',
  'remoteUpdatedAt',
  'spreadsheetId',
];

export function isMulticaAgentProvider(value: unknown): boolean {
  return String(value || '').trim() === MULTICA_PROVIDER;
}

export function multicaScheduleOnlyEdit(
  editing: {
    Agent_Provider?: string;
    Agent_Provision_State?: string;
    Agent_Binding_ID?: string;
    Agent_Multica_Autopilot_ID?: string;
    Agent_Multica_Trigger_ID?: string;
    Agent_Multica_Agent_ID?: string;
    Agent_Multica_Workspace_ID?: string;
    Content?: string;
  } | null,
  form: {
    Content?: string;
    Agent_Multica_Agent_ID?: string;
    Agent_Multica_Workspace_ID?: string;
  },
): boolean {
  if (!editing || !isMulticaAgentProvider(editing.Agent_Provider)) return false;
  if (editing.Agent_Provision_State !== 'ready') return false;
  if (!editing.Agent_Binding_ID || !editing.Agent_Multica_Autopilot_ID || !editing.Agent_Multica_Trigger_ID) return false;
  if ((form.Content || '').trim() !== (editing.Content || '').trim()) return false;
  const agentId = form.Agent_Multica_Agent_ID || editing.Agent_Multica_Agent_ID || '';
  const workspaceId = form.Agent_Multica_Workspace_ID || editing.Agent_Multica_Workspace_ID || '';
  return agentId === (editing.Agent_Multica_Agent_ID || '')
    && workspaceId === (editing.Agent_Multica_Workspace_ID || '');
}

export function assertHttpsOrigin(value: string, label = '地址'): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label}不是有效的 URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label}只能使用 HTTP 或 HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`${label}只能是源站，不能带路径、查询或账号`);
  }
  return url.origin;
}

export function bindingMarker(bindingUuid: string): string {
  return `${MULTICA_BINDING_MARKER_PREFIX}${bindingUuid}`;
}

export function webhookTriggerLabel(bindingUuid: string): string {
  return `pai:${bindingUuid}`;
}

export function buildAutopilotTitle(topic: string, bindingUuid: string): string {
  const clean = topic.replace(/\s+/g, ' ').trim().slice(0, 40) || 'Agent Task';
  return `Personal AI · ${clean} · ${bindingUuid.slice(0, 8)}`;
}

export function buildAutopilotDescription(task: string, bindingUuid: string): string {
  const body = task.trim();
  return [
    body,
    '',
    `来源标记 ${bindingMarker(bindingUuid)}。`,
    '到期信息来自本次 webhook payload。',
  ].join('\n');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildContentRevision(task: string, agentId: string): Promise<string> {
  return sha256Hex(`${agentId}\n${task.trim()}`);
}

export async function buildMulticaIdempotencyKey(bindingUuid: string, executionKey: string): Promise<string> {
  const raw = `pai:${bindingUuid}:${executionKey}`;
  if (raw.length <= MULTICA_IDEMPOTENCY_LIMIT) return raw;
  return `pai:${await sha256Hex(raw)}`;
}

export function resolveWebhookUrl(input: {
  apiOrigin: string;
  webhookUrl?: string | null;
  webhookPath?: string | null;
}): { host: string; path: string; href: string } {
  const origin = assertHttpsOrigin(input.apiOrigin, 'API 地址');
  const direct = String(input.webhookUrl || '').trim();
  const href = direct || `${origin}${normalizeWebhookPath(input.webhookPath)}`;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new Error('Webhook URL 无法解析');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Webhook 必须是 HTTP 或 HTTPS');
  if (url.origin !== origin) throw new Error('Webhook host 与已选 API 地址不一致');
  if (!url.pathname.startsWith(MULTICA_WEBHOOK_PATH_PREFIX)) {
    throw new Error('Webhook 路径不在 Autopilot 入口前缀内');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Webhook URL 不能带查询、片段或账号');
  }
  const token = url.pathname.slice(MULTICA_WEBHOOK_PATH_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Webhook token 格式异常');
  return {
    host: url.host,
    path: url.pathname.replace(/^\//, ''),
    href: `${url.origin}${url.pathname}`,
  };
}

function normalizeWebhookPath(value: string | null | undefined): string {
  const path = String(value || '').trim();
  if (!path.startsWith(MULTICA_WEBHOOK_PATH_PREFIX)) {
    throw new Error('缺少 webhook_url，且 webhook_path 不在固定前缀内');
  }
  return path;
}

const VIEW_ID = /^[A-Za-z0-9_-]{8,}$/;
const VIEW_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

export function buildAutopilotViewUrl(webOrigin: string, workspaceSlug: string, autopilotId: string): string {
  return buildViewUrl(webOrigin, workspaceSlug, 'autopilots', autopilotId);
}

export function buildIssueViewUrl(webOrigin: string, workspaceSlug: string, issueId: string): string {
  return buildViewUrl(webOrigin, workspaceSlug, 'issues', issueId);
}

function buildViewUrl(webOrigin: string, workspaceSlug: string, kind: string, id: string): string {
  const origin = assertHttpsOrigin(webOrigin, '网页地址');
  if (!VIEW_SLUG.test(workspaceSlug)) throw new Error('workspace slug 无效');
  if (!VIEW_ID.test(id)) throw new Error('查看链接 id 无效');
  const url = `${origin}/${workspaceSlug}/${kind}/${id}`;
  if (url.includes('webhook') || url.includes('token') || url.includes('pat_')) {
    throw new Error('查看链接不能携带凭据');
  }
  return url;
}

export interface WebhookReceipt {
  dispatchState: 'accepted' | 'duplicate' | 'skipped' | 'ignored' | 'unknown';
  runId: string;
  issueId: string;
  taskId: string;
  deliveryConfirmed: boolean;
  reason: string;
}

export function parseMulticaWebhookReceipt(httpStatus: number, body: unknown): WebhookReceipt {
  const record = asRecord(body);
  const dispatchState = normalizeDispatchState(stringField(record, ['status']));
  const runId = stringField(record, ['run_id', 'runId']);
  const issueId = stringField(record, ['issue_id', 'issueId']);
  const taskId = stringField(record, ['task_id', 'taskId']);
  const reason = stringField(record, ['reason', 'error', 'message']);
  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const confirmed = httpOk && (dispatchState === 'accepted' || dispatchState === 'duplicate') && Boolean(runId);
  return {
    dispatchState: httpOk ? dispatchState : 'unknown',
    runId,
    issueId,
    taskId,
    deliveryConfirmed: confirmed,
    reason: confirmed ? '' : (reason || (httpOk ? dispatchState : `http_${httpStatus}`)),
  };
}

function normalizeDispatchState(value: string): WebhookReceipt['dispatchState'] {
  if (value === 'accepted' || value === 'duplicate' || value === 'skipped' || value === 'ignored') {
    return value;
  }
  return 'unknown';
}

export function findAutopilotForBinding(
  items: Array<{ id?: string; description?: string }>,
  bindingUuid: string,
): { status: 'none' | 'one' | 'many'; id?: string } {
  const marker = bindingMarker(bindingUuid);
  const matches = items.filter((item) => item.id && String(item.description || '').includes(marker));
  if (matches.length > 1) return { status: 'many' };
  if (matches.length === 1) return { status: 'one', id: matches[0].id };
  return { status: 'none' };
}

export function findWebhookTrigger(
  triggers: Array<{ id?: string; kind?: string; label?: string }> | undefined,
  bindingUuid: string,
): { status: 'none' | 'one' | 'many'; id?: string } {
  const label = webhookTriggerLabel(bindingUuid);
  const matches = (triggers || []).filter((trigger) => trigger.id && trigger.kind === 'webhook' && trigger.label === label);
  if (matches.length > 1) return { status: 'many' };
  if (matches.length === 1) return { status: 'one', id: matches[0].id };
  return { status: 'none' };
}

export function shouldCreateRemoteObject(input: {
  knownId?: string;
  found: 'none' | 'one' | 'many';
  pendingConfirmation?: boolean;
}): 'use' | 'create' | 'wait' | 'conflict' {
  if (input.found === 'many') return 'conflict';
  if (input.knownId || input.found === 'one') return 'use';
  if (input.pendingConfirmation) return 'wait';
  return 'create';
}

export function isUncertainWriteError(error: { status?: number } | null): boolean {
  if (!error || typeof error.status !== 'number') return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

export function publicMulticaFields(input: {
  bindingUuid: string;
  workspaceId: string;
  workspaceSlug: string;
  agentId: string;
  projectId?: string;
  autopilotId?: string;
  triggerId?: string;
  webOrigin: string;
  apiOrigin: string;
  userId: string;
  state: ProvisionState;
  contentRevision: string;
}): PublicMulticaFields {
  return {
    Agent_Provider: 'multica',
    Agent_Binding_ID: input.bindingUuid,
    Agent_Multica_Workspace_ID: input.workspaceId,
    Agent_Multica_Workspace_Slug: input.workspaceSlug,
    Agent_Multica_Agent_ID: input.agentId,
    Agent_Multica_Project_ID: input.projectId || '',
    Agent_Multica_Autopilot_ID: input.autopilotId || '',
    Agent_Multica_Trigger_ID: input.triggerId || '',
    Agent_Multica_Web_Origin: input.webOrigin,
    Agent_Multica_Api_Origin: input.apiOrigin,
    Agent_Multica_User_ID: input.userId,
    Agent_Provision_State: input.state,
    Agent_Content_Revision: input.contentRevision,
  };
}

export function pauseCopiedMulticaMessageRows(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const headers = rows[0];
  const provider = headers.indexOf('Agent_Provider');
  if (provider < 0) return rows;
  const status = headers.indexOf('Status');
  const state = headers.indexOf('Agent_Provision_State');
  const log = headers.indexOf('Exec_Log');
  return rows.map((row, index) => {
    if (index === 0 || row[provider] !== MULTICA_PROVIDER) return row;
    const next = row.slice();
    if (status >= 0) next[status] = 'Paused';
    if (state >= 0) next[state] = 'needs_reconnect';
    if (log >= 0) next[log] = '已复制表格，Multica 绑定已停用，需要在新表重新连接';
    return next;
  });
}

export function redactMulticaSecrets(value: string): string {
  return value
    .replace(/(\/api\/webhooks\/autopilots\/)[A-Za-z0-9_-]+/g, '$1[REDACTED]')
    .replace(/(capability=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]');
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function stringField(record: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

export function unwrapList(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  const record = asRecord(body);
  for (const key of ['items', 'data', ...keys]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}
