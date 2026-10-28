import {
  OFFICIAL_MULTICA_API_ORIGIN,
  asRecord,
  assertHttpsOrigin,
  stringField,
  unwrapList,
} from './multicaContract.js';

export class MulticaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'MulticaApiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface MulticaAccount {
  id: string;
  label: string;
}

export interface MulticaWorkspace {
  id: string;
  slug: string;
  name: string;
}

export interface MulticaAgent {
  id: string;
  name: string;
  runtimeLabel: string;
}

export interface MulticaProject {
  id: string;
  name: string;
}

export interface MulticaRuntime {
  id: string;
  name: string;
  status: string;
}

export interface MulticaTrigger {
  id: string;
  kind: string;
  label: string;
  enabled: boolean;
  webhookUrl: string;
  webhookPath: string;
}

export interface MulticaAutopilot {
  id: string;
  title: string;
  description: string;
  triggers: MulticaTrigger[];
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const ALLOWED_PATH = /^\/api\/(?:me|workspaces|agents|projects|runtimes|autopilots(?:\/[A-Za-z0-9_-]+(?:\/triggers(?:\/[A-Za-z0-9_-]+)?|\/runs)?)?)$/;

export class MulticaClient {
  private readonly origin: string;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: {
    apiOrigin?: string;
    pat: string;
    workspaceId?: string;
    fetchImpl?: FetchLike;
  }) {
    this.origin = assertHttpsOrigin(options.apiOrigin || OFFICIAL_MULTICA_API_ORIGIN, 'API 地址');
    this.fetchImpl = options.fetchImpl || fetch;
    if (!options.pat.trim()) throw new MulticaApiError('缺少 PAT', 0, 'missing_pat');
  }

  getMe(): Promise<MulticaAccount> {
    return this.request('/api/me').then(readAccount);
  }

  listWorkspaces(): Promise<MulticaWorkspace[]> {
    return this.request('/api/workspaces').then((body) =>
      unwrapList(body, ['workspaces']).map(readWorkspace).filter((item) => item.id));
  }

  listAgents(): Promise<MulticaAgent[]> {
    return this.request('/api/agents', true).then((body) =>
      unwrapList(body, ['agents']).map(readAgent).filter((item) => item.id));
  }

  listProjects(): Promise<MulticaProject[]> {
    return this.request('/api/projects', true).then((body) =>
      unwrapList(body, ['projects']).map(readProject).filter((item) => item.id));
  }

  listRuntimes(): Promise<MulticaRuntime[]> {
    return this.request('/api/runtimes', true).then((body) =>
      unwrapList(body, ['runtimes']).map(readRuntime).filter((item) => item.id));
  }

  listAutopilots(): Promise<MulticaAutopilot[]> {
    return this.request('/api/autopilots', true).then((body) =>
      unwrapList(body, ['autopilots']).map(readAutopilot));
  }

  getAutopilot(id: string): Promise<MulticaAutopilot> {
    return this.request(`/api/autopilots/${assertId(id)}`, true).then(readAutopilot);
  }

  createAutopilot(input: {
    title: string;
    description: string;
    agentId: string;
    projectId?: string;
  }): Promise<MulticaAutopilot> {
    const body: Record<string, string> = {
      title: input.title,
      description: input.description,
      assignee_type: 'agent',
      assignee_id: input.agentId,
      execution_mode: 'create_issue',
    };
    if (input.projectId) body.project_id = input.projectId;
    return this.request('/api/autopilots', true, { method: 'POST', body }).then(readAutopilot);
  }

  patchAutopilot(id: string, input: {
    description: string;
    agentId: string;
    projectId?: string;
  }): Promise<MulticaAutopilot> {
    const body: Record<string, string> = {
      description: input.description,
      assignee_type: 'agent',
      assignee_id: input.agentId,
    };
    if (input.projectId) body.project_id = input.projectId;
    return this.request(`/api/autopilots/${assertId(id)}`, true, { method: 'PATCH', body }).then(readAutopilot);
  }

  createWebhook(autopilotId: string, label: string): Promise<MulticaTrigger> {
    return this.request(`/api/autopilots/${assertId(autopilotId)}/triggers`, true, {
      method: 'POST',
      body: { kind: 'webhook', provider: 'generic', label },
    }).then(readTrigger);
  }

  patchTrigger(autopilotId: string, triggerId: string, enabled: boolean): Promise<MulticaTrigger> {
    return this.request(`/api/autopilots/${assertId(autopilotId)}/triggers/${assertId(triggerId)}`, true, {
      method: 'PATCH',
      body: { enabled },
    }).then(readTrigger);
  }

  archiveAutopilot(id: string): Promise<void> {
    return this.request(`/api/autopilots/${assertId(id)}`, true, { method: 'DELETE' }).then(() => undefined);
  }

  private async request(
    path: string,
    workspace = false,
    init: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<unknown> {
    if (!ALLOWED_PATH.test(path)) {
      throw new MulticaApiError('请求路径不在允许列表内', 0, 'path_rejected');
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.pat}`,
      Accept: 'application/json',
    };
    if (workspace) {
      if (!this.options.workspaceId) {
        throw new MulticaApiError('尚未选择 workspace', 0, 'missing_workspace');
      }
      headers['X-Workspace-ID'] = this.options.workspaceId;
    }
    if (init.body) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.origin}${path}`, {
        method: init.method || 'GET',
        headers,
        body: init.body ? JSON.stringify(init.body) : undefined,
        redirect: 'error',
      });
    } catch {
      throw new MulticaApiError('无法连接 Multica API', 0, 'network');
    }
    const text = await response.text();
    if (!response.ok) {
      throw new MulticaApiError(
        safeMessage(response.status, text, this.options.pat),
        response.status,
        statusCode(response.status),
      );
    }
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new MulticaApiError('Multica 返回了无法解析的内容', response.status, 'invalid_response');
    }
  }
}

function safeMessage(status: number, body: string, pat: string): string {
  let text = body.slice(0, 240);
  if (pat) text = text.split(pat).join('[REDACTED]');
  text = text.replace(/\/api\/webhooks\/autopilots\/[A-Za-z0-9_-]+/g, '/api/webhooks/autopilots/[REDACTED]');
  return `Multica API ${status}${text ? `: ${text}` : ''}`;
}

function statusCode(status: number): string {
  if (status === 401) return 'pat_rejected';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  return 'http_error';
}

function assertId(value: string): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{8,}$/.test(id)) {
    throw new MulticaApiError('对象 id 无效', 0, 'invalid_id');
  }
  return id;
}

function readAccount(body: unknown): MulticaAccount {
  const record = asRecord(body);
  const user = Object.keys(asRecord(record.user)).length ? asRecord(record.user) : record;
  const id = stringField(user, ['id', 'user_id', 'userId']);
  if (!id) throw new MulticaApiError('账号响应缺少 id', 200, 'invalid_response');
  return { id, label: stringField(user, ['email', 'name', 'display_name']) || id };
}

function readWorkspace(value: unknown): MulticaWorkspace {
  const record = asRecord(value);
  return {
    id: stringField(record, ['id']),
    slug: stringField(record, ['slug']),
    name: stringField(record, ['name', 'title']) || stringField(record, ['slug']),
  };
}

function readAgent(value: unknown): MulticaAgent {
  const record = asRecord(value);
  const runtime = asRecord(record.runtime);
  return {
    id: stringField(record, ['id']),
    name: stringField(record, ['name', 'title']) || stringField(record, ['id']),
    runtimeLabel: stringField(record, ['runtime_status', 'availability'])
      || stringField(runtime, ['status', 'name'])
      || '未返回可用性',
  };
}

function readProject(value: unknown): MulticaProject {
  const record = asRecord(value);
  return { id: stringField(record, ['id']), name: stringField(record, ['name', 'title']) || stringField(record, ['id']) };
}

function readRuntime(value: unknown): MulticaRuntime {
  const record = asRecord(value);
  return {
    id: stringField(record, ['id']),
    name: stringField(record, ['name', 'label']) || stringField(record, ['id']),
    status: stringField(record, ['status', 'state']) || 'unknown',
  };
}

function readAutopilot(value: unknown): MulticaAutopilot {
  const record = asRecord(value);
  const nested = asRecord(record.autopilot);
  const source = stringField(nested, ['id']) ? nested : record;
  const id = stringField(source, ['id']);
  if (!id) throw new MulticaApiError('Autopilot 响应缺少 id', 200, 'invalid_response');
  const triggers = unwrapList(source.triggers ?? record.triggers, ['triggers']).map(readTrigger);
  return {
    id,
    title: stringField(source, ['title', 'name']),
    description: stringField(source, ['description']),
    triggers,
  };
}

function readTrigger(value: unknown): MulticaTrigger {
  const record = asRecord(value);
  const nested = asRecord(record.trigger);
  const source = stringField(nested, ['id']) ? nested : record;
  return {
    id: stringField(source, ['id']),
    kind: stringField(source, ['kind']),
    label: stringField(source, ['label']),
    enabled: source.enabled !== false,
    webhookUrl: stringField(source, ['webhook_url', 'webhookUrl']),
    webhookPath: stringField(source, ['webhook_path', 'webhookPath']),
  };
}
