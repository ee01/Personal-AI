import type { ScheduledMessage } from './types';
import {
  formatLocalScheduleDate,
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
} from './scheduleDateTime.js';
import {
  calculateScheduledMessageNextExecution,
  isExecutorDrivenSchedule,
} from './scheduleNextExecution.js';

const EXECUTOR_COMPENSATION_WINDOW_MINUTES = 30;
const APPS_SCRIPT_GRACE_WINDOW_MINUTES = 1;

export type ScheduleHealthIssueCode = 'invalid_time' | 'missed_execution';

export interface ScheduleHealthIssue {
  code: ScheduleHealthIssueCode;
  messageId: string;
  topic: string;
  nextExecution: string;
  isExecutorDriven: boolean;
  summary: string;
  action: string;
}

type ScheduleHealthMessage = Pick<
  ScheduledMessage,
  | 'ID'
  | 'Topic'
  | 'Schedule_Date'
  | 'Schedule_Time'
  | 'End_Date'
  | 'Repeat_Every'
  | 'Repeat_Unit'
  | 'Repeat_Days'
  | 'Push_Method'
  | 'AI_Endpoint'
  | 'Status'
  | 'Automation_Link'
  | 'Timeline_Milestone'
  | 'Last_Exec'
  | 'Exec_Log'
>;

function hasExplicitScheduleTime(message: Pick<ScheduledMessage, 'Schedule_Time'>): boolean {
  return hasLocalScheduleTime(message.Schedule_Time);
}

function isTimelineTriggeredMessage(message: Pick<ScheduledMessage, 'Schedule_Date' | 'Timeline_Milestone'>): boolean {
  return Boolean(!message.Schedule_Date && message.Timeline_Milestone);
}

function parseScheduleDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }

  return date;
}

function isTerminalExecutionForDate(
  message: Pick<ScheduledMessage, 'Last_Exec' | 'Exec_Log'>,
  executionDate: string,
): boolean {
  if (!executionDate || !message.Last_Exec) {
    return false;
  }

  const lastExecDate = message.Last_Exec.toString().slice(0, 10);
  if (lastExecDate !== executionDate) {
    return false;
  }

  const execLog = message.Exec_Log || '';
  return execLog.includes('✅') ||
    execLog.includes('成功') ||
    execLog.includes('❌') ||
    execLog.includes('失败');
}

function getMissedExecutionAction(message: ScheduleHealthMessage, isExecutorDriven: boolean): string {
  if (!hasExplicitScheduleTime(message) && isExecutorDriven) {
    return '改成今天或未来日期，或填写明确时间。';
  }

  return isExecutorDriven
    ? '改成未来明确时间，或清空时间进入 08:00 后队列。'
    : '改成未来时间后才会发送。';
}

export function getScheduleHealthIssue(
  message: ScheduleHealthMessage,
  now = new Date(),
): ScheduleHealthIssue | null {
  if (message.Status !== 'Active') {
    return null;
  }

  if (message.Automation_Link && !message.Schedule_Date) {
    return null;
  }

  if (isTimelineTriggeredMessage(message)) {
    return null;
  }

  if (!message.Schedule_Date) {
    return null;
  }

  const isExecutorDriven = isExecutorDrivenSchedule({
    Push_Method: message.Push_Method,
    AI_Endpoint: message.AI_Endpoint,
  });
  const explicitTime = hasExplicitScheduleTime(message);

  if (explicitTime && !normalizeLocalScheduleTime(message.Schedule_Time)) {
    return {
      code: 'invalid_time',
      messageId: message.ID,
      topic: message.Topic || message.ID,
      nextExecution: '',
      isExecutorDriven,
      summary: '执行时间格式异常',
      action: '编辑为 00:00-23:59 的本地时间。',
    };
  }

  const nextExecution = calculateScheduledMessageNextExecution(message, now);
  if (!nextExecution) {
    return null;
  }

  const executionDate = nextExecution.slice(0, 10);
  if (isTerminalExecutionForDate(message, executionDate)) {
    return null;
  }

  if (!explicitTime && isExecutorDriven) {
    const today = formatLocalScheduleDate(now);
    if (executionDate >= today) {
      return null;
    }

    return {
      code: 'missed_execution',
      messageId: message.ID,
      topic: message.Topic || message.ID,
      nextExecution,
      isExecutorDriven,
      summary: '未设时间的执行日期已过',
      action: getMissedExecutionAction(message, isExecutorDriven),
    };
  }

  const nextDate = parseScheduleDateTime(nextExecution);
  if (!nextDate) {
    return null;
  }

  const allowedLagMinutes = isExecutorDriven
    ? EXECUTOR_COMPENSATION_WINDOW_MINUTES
    : APPS_SCRIPT_GRACE_WINDOW_MINUTES;
  const missedAfterMs = nextDate.getTime() + allowedLagMinutes * 60 * 1000;
  if (missedAfterMs >= now.getTime()) {
    return null;
  }

  return {
    code: 'missed_execution',
    messageId: message.ID,
    topic: message.Topic || message.ID,
    nextExecution,
    isExecutorDriven,
    summary: isExecutorDriven
      ? '已超过 30 分钟补偿窗口'
      : '执行时间已过',
    action: getMissedExecutionAction(message, isExecutorDriven),
  };
}

export function getScheduleHealthIssues(
  messages: ScheduleHealthMessage[],
  now = new Date(),
): ScheduleHealthIssue[] {
  return messages
    .map(message => getScheduleHealthIssue(message, now))
    .filter((issue): issue is ScheduleHealthIssue => Boolean(issue));
}

export function formatScheduleHealthIssue(issue: ScheduleHealthIssue): string {
  const nextLabel = issue.nextExecution ? `${issue.nextExecution} · ` : '';
  return `${nextLabel}${issue.summary}，${issue.action}`;
}

export function formatScheduleHealthSummary(issues: ScheduleHealthIssue[]): string {
  const invalidCount = issues.filter(issue => issue.code === 'invalid_time').length;
  const missedCount = issues.filter(issue => issue.code === 'missed_execution').length;
  const parts = [`${issues.length} 条 Active 定时消息需要处理`];

  if (missedCount > 0) {
    parts.push(`${missedCount} 条已错过执行窗口`);
  }

  if (invalidCount > 0) {
    parts.push(`${invalidCount} 条时间格式异常`);
  }

  return parts.join('；');
}
