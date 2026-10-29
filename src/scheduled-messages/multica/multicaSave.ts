import type { CreateMessageFormData, ScheduledMessage } from '../types';
import type { ScheduledMessageService } from '../ScheduledMessageService';
import { JiraRuleUpdater } from '../JiraRuleUpdater.js';
import {
  OFFICIAL_MULTICA_API_ORIGIN,
  OFFICIAL_MULTICA_WEB_ORIGIN,
  buildContentRevision,
  multicaScheduleOnlyEdit,
} from './multicaContract.js';
import {
  MULTICA_CAPABILITY_KEY,
  MULTICA_RULE_STAMP_KEY,
  ensureSchedulerCapability,
  sendMulticaExtensionMessage,
  type KeyValueStorage,
} from './multicaConnection.js';
import {
  provisionMulticaScheduledTask,
  type MulticaProvisionRemote,
  type ProvisionProgress,
} from './multicaProvision.js';

const PROGRESS_KEY = 'multicaProvisionProgress';

export { multicaScheduleOnlyEdit };

function browserLocal(): KeyValueStorage {
  return {
    get: (keys) => chrome.storage.local.get(keys) as Promise<Record<string, unknown>>,
    set: (items) => chrome.storage.local.set(items),
    remove: (keys) => chrome.storage.local.remove(keys),
  };
}

function sendMultica(type: string, data?: Record<string, unknown>): Promise<any> {
  return sendMulticaExtensionMessage(type, data);
}

export function createChromeMulticaRemote(): MulticaProvisionRemote {
  return {
    listAutopilots: async () => (await sendMultica('MULTICA_LIST_AUTOPILOTS')).autopilots || [],
    getAutopilot: async (id) => (await sendMultica('MULTICA_GET_AUTOPILOT', { autopilotId: id })).autopilot,
    createAutopilot: async (input) => (await sendMultica('MULTICA_CREATE_AUTOPILOT', input)).autopilot,
    patchAutopilot: async (input) => {
      await sendMultica('MULTICA_PATCH_AUTOPILOT', input);
    },
    createWebhook: async (input) => {
      const response = await sendMultica('MULTICA_CREATE_WEBHOOK', input);
      const trigger = response.trigger || {};
      return {
        id: trigger.id || response.id || '',
        webhookUrl: trigger.webhookUrl || response.webhookUrl,
        webhookPath: trigger.webhookPath || response.webhookPath,
      };
    },
    patchTrigger: async (input) => {
      await sendMultica('MULTICA_PATCH_TRIGGER', input);
    },
  };
}

export async function archiveMulticaAutopilot(autopilotId: string): Promise<void> {
  await sendMultica('MULTICA_ARCHIVE', { autopilotId });
}

export async function setMulticaTriggerEnabled(
  autopilotId: string,
  triggerId: string,
  enabled: boolean,
): Promise<void> {
  await sendMultica('MULTICA_PATCH_TRIGGER', { autopilotId, triggerId, enabled });
}

async function readProgress(local: KeyValueStorage, bindingUuid: string): Promise<ProvisionProgress | null> {
  const stored = await local.get([PROGRESS_KEY]);
  const map = stored[PROGRESS_KEY];
  if (!map || typeof map !== 'object') return null;
  const item = (map as Record<string, ProvisionProgress>)[bindingUuid];
  return item || null;
}

async function writeProgress(local: KeyValueStorage, progress: ProvisionProgress): Promise<void> {
  const stored = await local.get([PROGRESS_KEY]);
  const map = stored[PROGRESS_KEY] && typeof stored[PROGRESS_KEY] === 'object'
    ? { ...(stored[PROGRESS_KEY] as Record<string, ProvisionProgress>) }
    : {};
  map[progress.bindingUuid] = progress;
  await local.set({ [PROGRESS_KEY]: map });
}

export async function saveMulticaScheduledAgentTask(input: {
  service: ScheduledMessageService;
  editing: ScheduledMessage | null;
  form: CreateMessageFormData;
  spreadsheetId: string;
  updateJiraRule?: () => Promise<boolean>;
  local?: KeyValueStorage;
  remote?: MulticaProvisionRemote;
}): Promise<{ message: ScheduledMessage; receipt: string }> {
  const local = input.local || browserLocal();
  const editing = input.editing;
  const scheduleOnly = multicaScheduleOnlyEdit(editing, input.form);
  if (!scheduleOnly && input.form.Multica_Connection_Ready !== true) {
    throw new Error(input.form.Multica_Block_Reason || '请先验证 Multica 连接并选择 Agent');
  }

  const apiOrigin = input.form.Agent_Multica_Api_Origin || editing?.Agent_Multica_Api_Origin || OFFICIAL_MULTICA_API_ORIGIN;
  const webOrigin = input.form.Agent_Multica_Web_Origin || editing?.Agent_Multica_Web_Origin || OFFICIAL_MULTICA_WEB_ORIGIN;
  const workspaceId = input.form.Agent_Multica_Workspace_ID || editing?.Agent_Multica_Workspace_ID || '';
  const workspaceSlug = input.form.Agent_Multica_Workspace_Slug || editing?.Agent_Multica_Workspace_Slug || '';
  const agentId = input.form.Agent_Multica_Agent_ID || editing?.Agent_Multica_Agent_ID || '';
  const projectId = input.form.Agent_Multica_Project_ID || editing?.Agent_Multica_Project_ID || '';
  const userId = input.form.Agent_Multica_User_ID || editing?.Agent_Multica_User_ID || '';
  const bindingUuid = (editing?.Agent_Binding_ID || input.form.Agent_Binding_ID || crypto.randomUUID()).trim();
  const task = (input.form.Content || '').trim();
  const contentRevision = await buildContentRevision(task, agentId);

  const formForSheet: CreateMessageFormData = {
    ...input.form,
    Agent_Provider: 'multica',
    Agent_Binding_ID: bindingUuid,
    Agent_Multica_Api_Origin: apiOrigin,
    Agent_Multica_Web_Origin: webOrigin,
    Agent_Multica_Workspace_ID: workspaceId,
    Agent_Multica_Workspace_Slug: workspaceSlug,
    Agent_Multica_Agent_ID: agentId,
    Agent_Multica_Project_ID: projectId,
    Agent_Multica_User_ID: userId,
    Agent_Executor: '',
    Agent_Notify_Template: '',
    Agent_Notify_Success_Receipt: 'N',
    Glip_User_Name: undefined,
    Glip_Team_ID: undefined,
    Multica_Connection_Ready: undefined,
    Multica_Block_Reason: undefined,
  };

  const message = editing
    ? await input.service.updateMessage(editing.ID, {
      ...formForSheet,
      ...(scheduleOnly ? {} : { Status: 'Paused', Exec_Log: 'Multica 创建中，计划尚未启用' }),
    })
    : await input.service.createMessage(formForSheet, {
      status: 'Paused',
      execLog: 'Multica 创建中，计划尚未启用',
    });

  if (!(await readProgress(local, bindingUuid)) && editing?.Agent_Multica_Autopilot_ID) {
    await writeProgress(local, {
      bindingUuid,
      messageId: message.ID,
      contentRevision: editing.Agent_Content_Revision || '',
      state: editing.Agent_Provision_State === 'ready' ? 'ready' : 'webhook_created',
      autopilotId: editing.Agent_Multica_Autopilot_ID,
      triggerId: editing.Agent_Multica_Trigger_ID || '',
      pendingConfirmation: editing.Agent_Provision_State === 'pending_confirmation',
      updatedAt: new Date().toISOString(),
    });
  }

  const capability = await ensureSchedulerCapability(local);
  await input.service.upsertConfigValue('multica_scheduler_capability', capability);
  await local.set({ [MULTICA_CAPABILITY_KEY]: capability });
  const stamp = `${capability}:${JiraRuleUpdater.getLatestVersion()}`;
  const stampStore = await local.get([MULTICA_RULE_STAMP_KEY]);
  let jiraReady = stampStore[MULTICA_RULE_STAMP_KEY] === stamp;
  if (!jiraReady && input.updateJiraRule) {
    try {
      jiraReady = await input.updateJiraRule();
    } catch {
      jiraReady = false;
    }
    if (jiraReady) await local.set({ [MULTICA_RULE_STAMP_KEY]: stamp });
  }

  const result = await provisionMulticaScheduledTask({
    bindingUuid,
    messageId: message.ID,
    topic: input.form.Topic || '帮我做',
    task,
    agentId,
    projectId,
    workspaceId,
    workspaceSlug,
    apiOrigin,
    webOrigin,
    multicaUserId: userId,
    connectionKey: `${apiOrigin}|${userId}|${workspaceId}`,
    spreadsheetId: input.spreadsheetId,
    contentRevision,
    jiraReady,
    scheduleOnly,
  }, {
    remote: input.remote || createChromeMulticaRemote(),
    loadProgress: (id) => readProgress(local, id),
    saveProgress: (progress) => writeProgress(local, progress),
    updateSheet: (messageId, fields) => input.service.updateMessage(messageId, fields).then(() => undefined),
    writeBinding: (record) => input.service.upsertMulticaBinding(record),
  });

  return { message, receipt: result.receipt };
}
