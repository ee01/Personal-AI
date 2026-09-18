/**
 * Bidirectional mapping between Task Center ledger rows and Scheduled Messages
 * Sheet rows. The extension owns Google writes; this module stays pure.
 */

import type { TaskCenterTask, TaskKind } from '../services/MemoryServiceClient';
import type {
  CreateMessageFormData,
  PushMethod,
  RepeatUnit,
  ScheduledMessage,
  TargetType,
  TimelineMilestone,
  TimelineProject,
} from './types';
import { isTimelineRecurrenceSpec, TIMELINE_TRIGGER } from '../modals/taskCenterSchedule';

export const JIRA_SHEET_LEDGER_KEY_PREFIX = 'jira_sheet:';

export function jiraSheetLedgerKey(sheetMessageId: string): string {
  return `${JIRA_SHEET_LEDGER_KEY_PREFIX}${sheetMessageId.trim()}`;
}

export function sheetMessageIdFromMirror(
  mirrorRef?: Record<string, unknown> | null,
): string {
  const raw = mirrorRef?.sheetMessageId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
}

export function isSheetMirrorPending(task: Pick<TaskCenterTask, 'lane' | 'mirrorRef'>): boolean {
  return task.lane === 'jira_sheet' && !sheetMessageIdFromMirror(task.mirrorRef);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalScheduleParts(epochSeconds: number): {
  dateStr: string;
  timeStr: string;
} {
  const date = new Date(epochSeconds * 1000);
  return {
    dateStr: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    timeStr: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

export function parseSheetScheduleToEpochSeconds(
  dateStr?: string,
  timeStr?: string,
): number | undefined {
  const date = nonEmpty(dateStr);
  if (!date) return undefined;
  const time = nonEmpty(timeStr) || '09:00';
  const parsed = new Date(`${date}T${time}:00`);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

function notifyViaFromTask(params: Record<string, unknown>): string {
  const metadata = asRecord(params.metadata);
  return nonEmpty(metadata.notifyVia) || nonEmpty(params.notifyVia) || nonEmpty(params.channel);
}

function notifyTargetFromTask(params: Record<string, unknown>): Record<string, unknown> {
  const metadata = asRecord(params.metadata);
  const target = metadata.notifyTarget ?? params.notifyTarget;
  return asRecord(target);
}

function isTimelineSheetMessage(message: Pick<ScheduledMessage, 'Schedule_Date' | 'Timeline_Milestone'>): boolean {
  return !nonEmpty(message.Schedule_Date) && Boolean(nonEmpty(message.Timeline_Milestone));
}

export function pushMethodFromLedgerTask(
  task: Pick<TaskCenterTask, 'taskKind' | 'params'>,
): PushMethod {
  if (task.taskKind === 'agent' || task.taskKind === 'dev') return 'AgentTask';
  if (task.taskKind === 'outreach') return 'Outreach';
  const params = asRecord(task.params);
  const method = nonEmpty(params.pushMethod).toLowerCase();
  if (method === 'ai') return 'AI';
  if (method === 'agent') return 'AgentTask';
  if (method === 'outreach') return 'Outreach';
  if (method === 'jiraautomation' || method === 'jira') return 'JiraAutomation';
  const via = notifyViaFromTask(params).toLowerCase();
  if (via === 'asme') return 'AsMe';
  // Sheet has no Chrome-plugin Push_Method. plugin (and anything else) becomes Bot
  // so leftover ledger rows still get a Jira-deliverable path. Task Center UI now
  // refuses plugin + jira_sheet so this fallback should stay rare.
  return 'Bot';
}

export function ledgerTaskToSheetForm(
  task: Pick<
    TaskCenterTask,
    'id' | 'title' | 'description' | 'taskKind' | 'params' | 'scheduledAt' | 'recurrenceSpec'
  >,
): CreateMessageFormData {
  const params = asRecord(task.params);
  const target = notifyTargetFromTask(params);
  const targetType: TargetType =
    target.type === 'group' || nonEmpty(target.targetGroupId) || nonEmpty(target.glipTeamId)
      ? 'group'
      : 'private';
  const spec = asRecord(task.recurrenceSpec);
  const fromSchedule = task.scheduledAt
    ? formatLocalScheduleParts(task.scheduledAt)
    : { dateStr: nonEmpty(spec.scheduleDate), timeStr: nonEmpty(spec.scheduleTime) };
  const content =
    nonEmpty(params.content) ||
    nonEmpty(params.body) ||
    nonEmpty(params.task) ||
    nonEmpty(task.description);
  const pushMethod = pushMethodFromLedgerTask(task);
  const via = notifyViaFromTask(params).toLowerCase();
  const timeline = isTimelineRecurrenceSpec(spec);
  const form: CreateMessageFormData = {
    Topic: task.title,
    Content: content,
    Schedule_Date: timeline ? '' : fromSchedule.dateStr || nonEmpty(spec.scheduleDate) || undefined,
    Schedule_Time: (timeline ? nonEmpty(spec.scheduleTime) : fromSchedule.timeStr || nonEmpty(spec.scheduleTime)) || undefined,
    Push_Method: pushMethod,
    Target_Type: targetType,
    Category: 'TaskCenter',
    Agent_Trigger_Source: 'jira_rule',
  };
  if (targetType === 'group') {
    form.Glip_Team_ID =
      nonEmpty(target.targetGroupId) || nonEmpty(target.glipTeamId) || undefined;
  } else {
    form.Glip_User_Name =
      nonEmpty(target.glipUserName) ||
      nonEmpty(target.glipUser) ||
      nonEmpty(target.targetUserId) ||
      undefined;
  }
  if (timeline) {
    form.Timeline_Project = (nonEmpty(spec.timelineProject) || undefined) as TimelineProject | undefined;
    form.Timeline_Milestone = (nonEmpty(spec.timelineMilestone) || undefined) as TimelineMilestone | undefined;
    const offset = Number(spec.timelineOffset);
    form.Timeline_Offset = Number.isInteger(offset) ? offset : 0;
    form.Repeat_Every = undefined;
    form.Repeat_Unit = undefined;
    form.Repeat_Days = undefined;
    form.Repeat_Count = undefined;
    form.End_Date = undefined;
  } else {
    form.Timeline_Project = undefined;
    form.Timeline_Milestone = undefined;
    form.Timeline_Offset = undefined;
    const every = Number(spec.repeatEvery);
    if (Number.isFinite(every) && every > 0) {
      form.Repeat_Every = every;
      form.Repeat_Unit = (nonEmpty(spec.repeatUnit) as RepeatUnit) || 'Day';
    } else {
      form.Repeat_Every = undefined;
      form.Repeat_Unit = undefined;
    }
    form.Repeat_Days = nonEmpty(spec.repeatDays) || undefined;
    form.End_Date = nonEmpty(spec.endDate) || undefined;
    const repeatCount = Number(spec.repeatCount);
    form.Repeat_Count = Number.isFinite(repeatCount) && repeatCount > 0 ? repeatCount : undefined;
  }

  if (pushMethod === 'AgentTask') {
    form.Agent_Task_ID = task.id;
    form.Agent_Mode = nonEmpty(params.mode) === 'write' ? 'write' : 'read';
    form.Agent_Notify_Via = via === 'asme' ? 'asme' : 'bot';
    form.Agent_Notify_Success_Receipt = params.successReceipt === false ? 'N' : 'Y';
    form.Agent_Notify_When_Empty = params.notifyWhenEmpty === true ? 'Y' : 'N';
  }
  if (pushMethod === 'AI') {
    form.AI_Endpoint = nonEmpty(params.aiEndpoint) || undefined;
    form.AI_Headers = nonEmpty(params.aiHeaders) || undefined;
    form.AI_Body = nonEmpty(params.extraText) || nonEmpty(params.aiBody) || undefined;
  }
  return form;
}

export function sheetStatusToQueueStatus(
  status: ScheduledMessage['Status'] | undefined,
): string | undefined {
  if (status === 'Paused') return 'paused';
  if (status === 'Done' || status === 'Completed') return 'succeeded';
  return undefined;
}

export function taskKindFromSheet(message: Pick<ScheduledMessage, 'Push_Method'>): TaskKind {
  if (message.Push_Method === 'AgentTask') return 'agent';
  if (message.Push_Method === 'Outreach') return 'outreach';
  return 'push';
}

export function sheetMessageToLedgerBody(message: ScheduledMessage): {
  taskKind: TaskKind;
  title: string;
  description?: string;
  lane: 'jira_sheet';
  cloudLaneAvailable: true;
  idempotencyKey: string;
  sourceKind: 'scheduled_messages';
  sourceRefId: string;
  scheduledAt?: number;
  recurrenceSpec?: Record<string, unknown> | null;
  mirrorRef: { sheetMessageId: string; syncState: 'synced' };
  payload: Record<string, unknown>;
} {
  const taskKind = taskKindFromSheet(message);
  const targetType: TargetType = message.Target_Type === 'group' ? 'group' : 'private';
  const notifyVia =
    message.Agent_Notify_Via === 'asme' || message.Push_Method === 'AsMe' ? 'asme' : 'bot';
  const notifyTarget =
    targetType === 'group'
      ? {
          type: 'group',
          targetGroupId: message.Glip_Team_ID,
          glipTeamId: message.Glip_Team_ID,
        }
      : {
          type: 'private',
          glipUserName: message.Glip_User_Name,
          glipUser: message.Glip_User_Name,
          targetUserId: message.Glip_User_Name,
        };
  const recurrenceSpec = isTimelineSheetMessage(message)
    ? {
        trigger: TIMELINE_TRIGGER,
        timelineProject: message.Timeline_Project,
        timelineMilestone: message.Timeline_Milestone,
        timelineOffset: message.Timeline_Offset ?? 0,
        scheduleTime: message.Schedule_Time,
      }
    : message.Repeat_Every && message.Repeat_Every > 0
      ? {
          repeatEvery: message.Repeat_Every,
          repeatUnit: message.Repeat_Unit || 'Day',
          repeatDays: message.Repeat_Days,
          endDate: message.End_Date,
          repeatCount: message.Repeat_Count,
          scheduleDate: message.Schedule_Date,
          scheduleTime: message.Schedule_Time,
        }
      : null;
  return {
    taskKind,
    title: message.Topic,
    description: message.Content,
    lane: 'jira_sheet',
    cloudLaneAvailable: true,
    idempotencyKey: jiraSheetLedgerKey(message.ID),
    sourceKind: 'scheduled_messages',
    sourceRefId: message.ID,
    scheduledAt: parseSheetScheduleToEpochSeconds(message.Schedule_Date, message.Schedule_Time),
    recurrenceSpec,
    mirrorRef: { sheetMessageId: message.ID, syncState: 'synced' },
    payload: {
      content: message.Content,
      pushMethod:
        message.Push_Method === 'AI'
          ? 'ai'
          : message.Push_Method === 'AgentTask'
            ? 'agent'
            : message.Push_Method === 'Outreach'
              ? 'outreach'
              : undefined,
      notifyVia,
      notifyTarget,
      mode: message.Agent_Mode === 'write' ? 'write' : 'read',
      successReceipt: message.Agent_Notify_Success_Receipt !== 'N',
      notifyWhenEmpty: message.Agent_Notify_When_Empty === 'Y',
    },
  };
}

export function foldReflectionTasks<T extends { taskKind?: string; title: string }>(
  tasks: T[],
): Array<T & { reflectionDupes?: number }> {
  const result: Array<T & { reflectionDupes?: number }> = [];
  const reflectionIndex = new Map<string, number>();
  for (const task of tasks) {
    if (task.taskKind !== 'reflection') {
      result.push(task);
      continue;
    }
    const key = task.title.trim() || '(untitled)';
    const existing = reflectionIndex.get(key);
    if (existing === undefined) {
      reflectionIndex.set(key, result.length);
      result.push(task);
      continue;
    }
    const row = result[existing];
    row.reflectionDupes = (row.reflectionDupes ?? 1) + 1;
  }
  return result;
}

export function isInboxTask(task: Pick<TaskCenterTask, 'queueStatus'>): boolean {
  return ['failed', 'dead_letter', 'input_required'].includes(task.queueStatus);
}
