import {
  getGoogleAuthToken,
  getGoogleAuthTokenSilently,
  GOOGLE_AUTH_SCOPE_SETS,
} from '../utils/googleAuth';
import { getMemoryServiceClient, type TaskCenterTask, type UpdateRuntimeConfigPayload } from './MemoryServiceClient';
import { ScheduledMessageService } from '../scheduled-messages/ScheduledMessageService';
import type { ScheduledMessage, SheetConfig } from '../scheduled-messages/types';
import { ConfigSyncService } from '../scheduled-messages/ConfigSyncService';
import {
  isSheetMirrorPending,
  jiraSheetLedgerKey,
  ledgerTaskToSheetForm,
  sheetMessageIdFromMirror,
  sheetMessageToLedgerBody,
  sheetStatusToQueueStatus,
} from '../scheduled-messages/taskCenterSheetMirror';
import {
  mergeAsmePayloadIntoSheetConfig,
  type AsmeSheetPushResult,
} from '../modals/taskCenterCredentials';

export const TASK_CENTER_SHEET_MIRROR_MESSAGE = 'TASK_CENTER_SHEET_MIRROR';
export const TASK_CENTER_REGISTER_SHEET_MESSAGE = 'TASK_CENTER_REGISTER_SHEET_MESSAGE';

export type TaskCenterSheetMirrorAction =
  | 'upsert'
  | 'pause'
  | 'resume'
  | 'delete'
  | 'complete';

async function sheetsToken(interactive: boolean, caller: string): Promise<string> {
  const token = interactive
    ? await getGoogleAuthToken({
        caller,
        scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
      })
    : await getGoogleAuthTokenSilently({
        caller,
        scopes: GOOGLE_AUTH_SCOPE_SETS.SHEETS,
      });
  if (!token) {
    throw new Error('需要 Google 授权才能写 Sheet 镜像');
  }
  return token;
}

async function sheetService(interactive: boolean, caller: string): Promise<ScheduledMessageService> {
  const stored = await chrome.storage.local.get(['scheduledMessagesConfig']);
  if (!stored?.scheduledMessagesConfig?.sheetId) {
    throw new Error('未初始化 Level 2（Google Sheet），无法写 ☁️ 镜像');
  }
  return new ScheduledMessageService(await sheetsToken(interactive, caller));
}

export async function upsertTaskCenterSheetMirror(
  task: TaskCenterTask,
  options: { interactive?: boolean } = {},
): Promise<TaskCenterTask> {
  if (task.lane !== 'jira_sheet') return task;
  const interactive = options.interactive !== false;
  const service = await sheetService(interactive, 'taskCenter.upsertSheetMirror');
  const form = ledgerTaskToSheetForm(task);
  const existingId = sheetMessageIdFromMirror(task.mirrorRef);
  const saved = existingId
    ? await service.updateMessage(existingId, form)
    : await service.createMessage(form);
  const client = getMemoryServiceClient();
  const patched = await client.updateTaskCenterTask(task.id, {
    mirrorRef: { sheetMessageId: saved.ID, syncState: 'synced' },
    sourceRefId: saved.ID,
  });
  return patched.task ?? { ...task, mirrorRef: { sheetMessageId: saved.ID, syncState: 'synced' } };
}

export async function applyTaskCenterSheetMirrorControl(
  task: TaskCenterTask,
  action: Exclude<TaskCenterSheetMirrorAction, 'upsert'>,
  options: { interactive?: boolean } = {},
): Promise<void> {
  const sheetId = sheetMessageIdFromMirror(task.mirrorRef);
  if (!sheetId) return;
  const interactive = options.interactive !== false;
  const service = await sheetService(interactive, 'taskCenter.controlSheetMirror');
  if (action === 'delete') {
    await service.deleteMessage(sheetId);
    return;
  }
  const status =
    action === 'pause' ? 'Paused' : action === 'complete' ? 'Done' : 'Active';
  await service.updateMessage(sheetId, { Status: status } as Partial<ScheduledMessage>);
}

export async function registerSheetMessageInLedger(
  message: ScheduledMessage,
): Promise<TaskCenterTask | null> {
  const body = sheetMessageToLedgerBody(message);
  const client = getMemoryServiceClient();
  const existing = await client
    .findTaskCenterTaskByKey(body.idempotencyKey)
    .catch(() => ({ task: null }));
  if (existing.task) {
    const patched = await client.updateTaskCenterTask(existing.task.id, {
      title: body.title,
      description: body.description,
      payload: body.payload,
      lane: 'jira_sheet',
      cloudLaneAvailable: true,
      scheduledAt: body.scheduledAt,
      recurrenceSpec: body.recurrenceSpec,
      sourceRefId: body.sourceRefId,
    });
    const queueStatus = sheetStatusToQueueStatus(message.Status);
    // Full edit requeues; pause after that so a Paused Sheet row does not
    // come back as queued.
    if (queueStatus === 'paused' && patched.task?.queueStatus !== 'paused') {
      await client.controlTaskCenterTask(existing.task.id, 'pause').catch(() => undefined);
    }
    return patched.task;
  }
  const created = await client.createTaskCenterTask(body);
  return created.task;
}

export async function registerSheetMessageInLedgerSafe(
  message: ScheduledMessage,
): Promise<void> {
  try {
    await registerSheetMessageInLedger(message);
  } catch (error) {
    console.warn('Task Center ledger register skipped:', error);
  }
}

export async function unregisterSheetMessageFromLedgerSafe(
  sheetMessageId: string,
): Promise<void> {
  const id = sheetMessageId.trim();
  if (!id) return;
  try {
    const client = getMemoryServiceClient();
    const existing = await client.findTaskCenterTaskByKey(jiraSheetLedgerKey(id));
    if (existing.task) {
      await client.deleteTaskCenterTask(existing.task.id);
    }
  } catch (error) {
    console.warn('Task Center ledger unregister skipped:', error);
  }
}

export async function retryPendingTaskCenterMirrors(
  tasks: TaskCenterTask[],
  options: { interactive?: boolean } = {},
): Promise<number> {
  const pending = tasks.filter(isSheetMirrorPending);
  let synced = 0;
  for (const task of pending) {
    try {
      await upsertTaskCenterSheetMirror(task, options);
      synced += 1;
    } catch (error) {
      console.warn('Pending Task Center Sheet mirror failed:', task.id, error);
    }
  }
  return synced;
}

export async function pushAsmeCredentialsToSheet(
  payload: UpdateRuntimeConfigPayload,
): Promise<AsmeSheetPushResult> {
  const stored = await chrome.storage.local.get(['scheduledMessagesConfig']);
  const local = stored?.scheduledMessagesConfig as Partial<SheetConfig> | undefined;
  const sheetId = local?.sheetId?.trim();
  if (!sheetId) return { pushed: false, reason: 'no_sheet' };

  try {
    const token = await sheetsToken(true, 'taskCenter.pushAsmeToSheet');
    const sync = new ConfigSyncService(token);
    let base: Partial<SheetConfig> = local ?? { sheetId };
    try {
      const fromSheet = await sync.readConfigFromSheet(sheetId);
      if (fromSheet?.sheetId) base = { ...local, ...fromSheet };
    } catch (error) {
      console.warn('Task Center AsMe Sheet read skipped:', error);
    }
    const merged = mergeAsmePayloadIntoSheetConfig(base, payload);
    if (merged.kind === 'skip') {
      return { pushed: false, reason: merged.reason };
    }
    await sync.saveConfigToSheet(merged.config, undefined, {
      includeRingCentralSenderKeys: true,
      expectedLastSyncTime: merged.config.last_sync_time,
      syncAction: 'task_center_asme_push',
    });
    await sync.saveConfigToStorage(merged.config);
    return { pushed: true, reason: 'ok' };
  } catch (error) {
    return {
      pushed: false,
      reason: 'write_failed',
      error: (error as Error).message,
    };
  }
}
