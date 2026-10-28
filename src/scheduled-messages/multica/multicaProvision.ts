import type { MulticaApiError } from './multicaClient.js';
import {
  type MulticaBindingRecord,
  type ProvisionState,
  type PublicMulticaFields,
  bindingMarker,
  buildAutopilotDescription,
  buildAutopilotTitle,
  findAutopilotForBinding,
  findWebhookTrigger,
  isUncertainWriteError,
  publicMulticaFields,
  resolveWebhookUrl,
  shouldCreateRemoteObject,
  webhookTriggerLabel,
} from './multicaContract.js';

export interface ProvisionProgress {
  bindingUuid: string;
  messageId: string;
  contentRevision: string;
  state: ProvisionState;
  autopilotId: string;
  triggerId: string;
  pendingConfirmation: boolean;
  updatedAt: string;
}

export interface AutopilotSummary {
  id: string;
  description?: string;
  title?: string;
  triggers?: Array<{ id?: string; kind?: string; label?: string; webhook_url?: string | null; webhookUrl?: string; webhook_path?: string | null; webhookPath?: string }>;
}

export interface MulticaProvisionRemote {
  listAutopilots(): Promise<AutopilotSummary[]>;
  getAutopilot(id: string): Promise<AutopilotSummary>;
  createAutopilot(input: { title: string; description: string; agentId: string; projectId?: string }): Promise<AutopilotSummary>;
  patchAutopilot(input: { autopilotId: string; description: string; agentId: string; projectId?: string }): Promise<void>;
  createWebhook(input: { autopilotId: string; label: string }): Promise<{ id: string; webhookUrl?: string; webhookPath?: string }>;
  patchTrigger(input: { autopilotId: string; triggerId: string; enabled: boolean }): Promise<void>;
}

export interface MulticaProvisionDeps {
  remote: MulticaProvisionRemote;
  loadProgress(bindingUuid: string): Promise<ProvisionProgress | null>;
  saveProgress(progress: ProvisionProgress): Promise<void>;
  updateSheet(messageId: string, fields: PublicMulticaFields & { Status: 'Paused' | 'Active'; Exec_Log: string }): Promise<void>;
  writeBinding(record: MulticaBindingRecord): Promise<void>;
  now?: () => string;
}

export interface MulticaProvisionInput {
  bindingUuid: string;
  messageId: string;
  topic: string;
  task: string;
  agentId: string;
  projectId?: string;
  workspaceId: string;
  workspaceSlug: string;
  apiOrigin: string;
  webOrigin: string;
  multicaUserId: string;
  connectionKey: string;
  spreadsheetId: string;
  contentRevision: string;
  jiraReady: boolean;
  scheduleOnly: boolean;
}

export interface MulticaProvisionResult {
  state: ProvisionState;
  autopilotId: string;
  triggerId: string;
  activated: boolean;
  receipt: string;
}

export async function provisionMulticaScheduledTask(
  input: MulticaProvisionInput,
  deps: MulticaProvisionDeps,
): Promise<MulticaProvisionResult> {
  const run = async () => provisionBody(input, deps);
  const locks = (globalThis as { navigator?: { locks?: {
    request: (
      name: string,
      options: { ifAvailable: boolean },
      callback: (lock: unknown) => Promise<void>,
    ) => Promise<void>;
  } } }).navigator?.locks;
  if (!locks) return run();
  let result: MulticaProvisionResult | undefined;
  let denied = false;
  await locks.request(`pai-multica-${input.bindingUuid}`, { ifAvailable: true }, async (lock: unknown) => {
    if (!lock) {
      denied = true;
      return;
    }
    result = await run();
  });
  if (denied || !result) throw new Error('这条任务正在创建，请不要重复提交');
  return result;
}

async function provisionBody(input: MulticaProvisionInput, deps: MulticaProvisionDeps): Promise<MulticaProvisionResult> {
  const now = deps.now || (() => new Date().toISOString());
  let progress = await deps.loadProgress(input.bindingUuid) || {
    bindingUuid: input.bindingUuid,
    messageId: input.messageId,
    contentRevision: '',
    state: 'sheet_paused' as ProvisionState,
    autopilotId: '',
    triggerId: '',
    pendingConfirmation: false,
    updatedAt: now(),
  };
  progress.messageId = input.messageId;

  if (input.scheduleOnly && progress.autopilotId && progress.triggerId && progress.state === 'ready') {
    return finish(input, deps, progress, true);
  }

  const description = buildAutopilotDescription(input.task, input.bindingUuid);
  const title = buildAutopilotTitle(input.topic, input.bindingUuid);
  const autopilotId = await ensureAutopilot(input, deps, progress, title, description);
  progress = { ...progress, autopilotId, state: 'autopilot_created', pendingConfirmation: false, updatedAt: now() };
  await deps.saveProgress(progress);
  await updatePublic(input, deps, progress, 'autopilot_created', false);

  const hadTrigger = Boolean(progress.triggerId);
  const trigger = await ensureTrigger(input, deps, progress);
  progress = { ...progress, triggerId: trigger.id, state: 'webhook_created', pendingConfirmation: false, updatedAt: now() };
  await deps.saveProgress(progress);

  const detail = await deps.remote.getAutopilot(autopilotId);
  if (!descriptionMatches(detail.description, input.bindingUuid)) {
    throw new Error('Autopilot 描述里的绑定标记未读回，已停止启用');
  }
  const resolvedTrigger = (detail.triggers || []).find((item) => item.id === trigger.id) || trigger;
  let webhookHref = '';
  try {
    webhookHref = resolveWebhookUrl({
      apiOrigin: input.apiOrigin,
      webhookUrl: trigger.webhookUrl || resolvedTrigger.webhookUrl || resolvedTrigger.webhook_url,
      webhookPath: trigger.webhookPath || resolvedTrigger.webhookPath || resolvedTrigger.webhook_path,
    }).href;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const missing = message.includes('缺少 webhook') || message.includes('无法解析');
    if (!hadTrigger || !missing) throw error;
  }
  await deps.writeBinding({
    bindingUuid: input.bindingUuid,
    messageId: input.messageId,
    apiOrigin: input.apiOrigin,
    webAppOrigin: input.webOrigin,
    multicaUserId: input.multicaUserId,
    workspaceId: input.workspaceId,
    workspaceSlug: input.workspaceSlug,
    agentId: input.agentId,
    projectId: input.projectId || '',
    autopilotId,
    triggerId: trigger.id,
    contentRevision: input.contentRevision,
    provisionState: input.jiraReady ? 'ready' : 'binding_written',
    webhookUrl: webhookHref,
    createdByConnection: input.connectionKey,
    remoteUpdatedAt: now(),
    spreadsheetId: input.spreadsheetId,
  });
  progress = {
    ...progress,
    state: input.jiraReady ? 'ready' : 'binding_written',
    contentRevision: input.contentRevision,
    pendingConfirmation: false,
    updatedAt: now(),
  };
  await deps.saveProgress(progress);
  if (input.jiraReady) await deps.remote.patchTrigger({ autopilotId, triggerId: progress.triggerId, enabled: true });
  return finish(input, deps, progress, input.jiraReady);
}

async function ensureAutopilot(
  input: MulticaProvisionInput,
  deps: MulticaProvisionDeps,
  progress: ProvisionProgress,
  title: string,
  description: string,
): Promise<string> {
  if (progress.autopilotId && progress.contentRevision === input.contentRevision) return progress.autopilotId;
  const listed = progress.autopilotId ? [] : await deps.remote.listAutopilots();
  const found = progress.autopilotId
    ? { status: 'one' as const, id: progress.autopilotId }
    : findAutopilotForBinding(listed, input.bindingUuid);
  const action = shouldCreateRemoteObject({
    knownId: progress.autopilotId || found.id,
    found: found.status,
    pendingConfirmation: progress.pendingConfirmation,
  });
  if (action === 'conflict') throw new Error('找到多个带同一绑定标记的 Autopilot，已停止自动创建');
  if (action === 'wait') throw new Error('上一次创建结果还未确认。请稍后点重新检查，不要再次创建');
  const existingId = progress.autopilotId || found.id || '';
  if (action === 'use' && existingId) {
    if (progress.contentRevision !== input.contentRevision) {
      await deps.remote.patchAutopilot({
        autopilotId: existingId,
        description,
        agentId: input.agentId,
        projectId: input.projectId,
      });
    }
    return existingId;
  }
  try {
    const created = await deps.remote.createAutopilot({
      title,
      description,
      agentId: input.agentId,
      projectId: input.projectId,
    });
    if (!created.id) throw new Error('创建 Autopilot 的响应没有 id');
    await deps.saveProgress({
      ...progress,
      autopilotId: created.id,
      state: 'autopilot_created',
      pendingConfirmation: false,
      updatedAt: new Date().toISOString(),
    });
    return created.id;
  } catch (error) {
    if (isUncertainWriteError(error as MulticaApiError)) {
      await deps.saveProgress({ ...progress, pendingConfirmation: true, state: 'pending_confirmation', updatedAt: new Date().toISOString() });
    }
    throw error;
  }
}

async function ensureTrigger(
  input: MulticaProvisionInput,
  deps: MulticaProvisionDeps,
  progress: ProvisionProgress,
): Promise<{ id: string; webhookUrl?: string; webhookPath?: string }> {
  const detail = await deps.remote.getAutopilot(progress.autopilotId);
  if (progress.triggerId) {
    const existing = (detail.triggers || []).find((item) => item.id === progress.triggerId);
    return {
      id: progress.triggerId,
      webhookUrl: existing?.webhookUrl || existing?.webhook_url || '',
      webhookPath: existing?.webhookPath || existing?.webhook_path || '',
    };
  }
  const found = findWebhookTrigger(detail.triggers, input.bindingUuid);
  const action = shouldCreateRemoteObject({
    knownId: found.id,
    found: found.status,
    pendingConfirmation: progress.pendingConfirmation,
  });
  if (action === 'conflict') throw new Error('找到多个同标记 Webhook，已停止自动创建');
  if (action === 'wait') throw new Error('上一次 Webhook 创建结果还未确认。请稍后重新检查');
  if (action === 'use' && found.id) {
    const existing = (detail.triggers || []).find((item) => item.id === found.id);
    return {
      id: found.id,
      webhookUrl: existing?.webhookUrl || existing?.webhook_url || '',
      webhookPath: existing?.webhookPath || existing?.webhook_path || '',
    };
  }
  try {
    const created = await deps.remote.createWebhook({
      autopilotId: progress.autopilotId,
      label: webhookTriggerLabel(input.bindingUuid),
    });
    if (!created.id) throw new Error('创建 Webhook 的响应没有 id');
    await deps.saveProgress({
      ...progress,
      triggerId: created.id,
      state: 'webhook_created',
      pendingConfirmation: false,
      updatedAt: new Date().toISOString(),
    });
    return created;
  } catch (error) {
    if (isUncertainWriteError(error as MulticaApiError)) {
      await deps.saveProgress({ ...progress, pendingConfirmation: true, state: 'pending_confirmation', updatedAt: new Date().toISOString() });
    }
    throw error;
  }
}

async function finish(
  input: MulticaProvisionInput,
  deps: MulticaProvisionDeps,
  progress: ProvisionProgress,
  activated: boolean,
): Promise<MulticaProvisionResult> {
  const state: ProvisionState = activated ? 'ready' : 'binding_written';
  await updatePublic(input, deps, { ...progress, state }, state, activated);
  return {
    state,
    autopilotId: progress.autopilotId,
    triggerId: progress.triggerId,
    activated,
    receipt: activated
      ? '已安排，时间由 Jira 触发；执行与结果在 Multica。这次保存不会立即执行。'
      : 'Multica 已创建，计划尚未启用。Jira 规则或调度校验还没准备好，到期不会领取。',
  };
}

async function updatePublic(
  input: MulticaProvisionInput,
  deps: MulticaProvisionDeps,
  progress: ProvisionProgress,
  state: ProvisionState,
  activated: boolean,
): Promise<void> {
  const fields: PublicMulticaFields & { Status: 'Paused' | 'Active'; Exec_Log: string } = {
    ...publicMulticaFields({
      bindingUuid: input.bindingUuid,
      workspaceId: input.workspaceId,
      workspaceSlug: input.workspaceSlug,
      agentId: input.agentId,
      projectId: input.projectId,
      autopilotId: progress.autopilotId,
      triggerId: progress.triggerId,
      webOrigin: input.webOrigin,
      apiOrigin: input.apiOrigin,
      userId: input.multicaUserId,
      state,
      contentRevision: input.contentRevision,
    }),
    Status: activated ? 'Active' : 'Paused',
    Exec_Log: activated
      ? '已安排，时间由 Jira 触发；执行与结果在 Multica'
      : 'Multica 已创建，计划尚未启用',
  };
  await deps.updateSheet(input.messageId, fields);
}

function descriptionMatches(description: string | undefined, bindingUuid: string): boolean {
  return String(description || '').includes(bindingMarker(bindingUuid));
}
