import type { ScheduledMessage } from './types';
import {
  formatLocalScheduleDate,
  formatLocalScheduleDateTime,
  hasLocalScheduleTime,
  normalizeLocalScheduleTime,
  parseLocalScheduleTime,
} from './scheduleDateTime.js';
import {
  calculateScheduledMessageNextExecution,
  getDefaultScheduleTime,
  getDefaultScheduleTimeLabel,
  isExecutorDrivenSchedule,
} from './scheduleNextExecution.js';
import { getScheduleQueuePressure } from './scheduleQueuePressure.js';

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

export interface ScheduleHealthRecoverySuggestion {
  dateStr: string;
  timeStr: string;
  label: string;
  clearsScheduleTime: boolean;
  reason: string;
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

function hasExplicitScheduleTime(
  message: Pick<ScheduledMessage, 'Schedule_Time'>,
): boolean {
  return hasLocalScheduleTime(message.Schedule_Time);
}

function isTimelineTriggeredMessage(
  message: Pick<ScheduledMessage, 'Schedule_Date' | 'Timeline_Milestone'>,
): boolean {
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

function hasMissedMinuteWindow(
  scheduledAt: Date,
  now: Date,
  allowedLagMinutes: number,
): boolean {
  const lastAllowedMinute = new Date(scheduledAt);
  lastAllowedMinute.setSeconds(0, 0);
  lastAllowedMinute.setMinutes(
    lastAllowedMinute.getMinutes() + allowedLagMinutes,
  );

  const currentMinute = new Date(now);
  currentMinute.setSeconds(0, 0);

  return currentMinute.getTime() > lastAllowedMinute.getTime();
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
  return (
    execLog.includes('✅') ||
    execLog.includes('成功') ||
    execLog.includes('❌') ||
    execLog.includes('失败')
  );
}

function getMissedExecutionAction(
  message: ScheduleHealthMessage,
  isExecutorDriven: boolean,
): string {
  if (!hasExplicitScheduleTime(message) && isExecutorDriven) {
    return '改成今天或未来日期，或填写明确时间。';
  }

  return isExecutorDriven
    ? '改成未来明确时间，或清空时间进入 08:00 后队列。'
    : '改成未来时间后才会发送。';
}

function getNextCandidateMinute(now: Date): Date {
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (date.getTime() <= now.getTime()) {
    date.setMinutes(date.getMinutes() + 1);
  }
  return date;
}

function buildExplicitRecoverySuggestion(
  now: Date,
  reason: string,
): ScheduleHealthRecoverySuggestion {
  return buildExplicitRecoverySuggestionAt(getNextCandidateMinute(now), reason);
}

function buildExplicitRecoverySuggestionAt(
  date: Date,
  reason: string,
): ScheduleHealthRecoverySuggestion {
  const { dateStr, timeStr } = formatLocalScheduleDateTime(date);
  return {
    dateStr,
    timeStr,
    label: `${dateStr} ${timeStr}`,
    clearsScheduleTime: false,
    reason,
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getMinuteKey(date: Date): number {
  return Math.floor(date.getTime() / 60000);
}

function getExplicitRecoveryReason(issue: ScheduleHealthIssue): string {
  return issue.code === 'invalid_time'
    ? '把异常时间改成下一分钟的明确本地时间。'
    : '把已错过的明确时间改成下一分钟，恢复到可执行窗口内。';
}

function needsExplicitRecoverySuggestion(
  message: ScheduleHealthMessage,
  issue: ScheduleHealthIssue,
): boolean {
  return issue.code === 'invalid_time' || hasExplicitScheduleTime(message);
}

function getFutureExplicitReservationKeys(
  messages: ScheduleHealthMessage[],
  issueIds: Set<string>,
  now: Date,
): Set<number> {
  const reserved = new Set<number>();
  const firstRecoveryMinute = getNextCandidateMinute(now);

  for (const message of messages) {
    if (issueIds.has(message.ID)) {
      continue;
    }

    if (message.Status !== 'Active' || !hasExplicitScheduleTime(message)) {
      continue;
    }

    if (!normalizeLocalScheduleTime(message.Schedule_Time)) {
      continue;
    }

    const nextExecution = calculateScheduledMessageNextExecution(message, now);
    if (!nextExecution) {
      continue;
    }

    const executionDate = nextExecution.slice(0, 10);
    if (isTerminalExecutionForDate(message, executionDate)) {
      continue;
    }

    const scheduledAt = parseScheduleDateTime(nextExecution);
    if (!scheduledAt || scheduledAt.getTime() < firstRecoveryMinute.getTime()) {
      continue;
    }

    reserved.add(getMinuteKey(scheduledAt));
  }

  return reserved;
}

function getNextDefaultScheduleDate(
  message: ScheduleHealthMessage,
  now: Date,
): string {
  const { hours, minutes } = parseLocalScheduleTime(
    getDefaultScheduleTime(message),
  );
  const nextDefault = new Date(now);
  nextDefault.setHours(hours, minutes, 0, 0);
  if (nextDefault.getTime() <= now.getTime()) {
    nextDefault.setDate(nextDefault.getDate() + 1);
  }
  return formatLocalScheduleDate(nextDefault);
}

function hasNoTimeExecutorRunWindow(
  message: ScheduleHealthMessage,
  dateStr: string,
  now: Date,
): boolean {
  const candidateMessage: ScheduleHealthMessage = {
    ...message,
    Schedule_Date: dateStr,
    Schedule_Time: '',
  };
  const nextExecution = calculateScheduledMessageNextExecution(
    candidateMessage,
    now,
  );
  const slotTime = parseScheduleDateTime(nextExecution);
  if (!slotTime) {
    return false;
  }

  const queueStart = new Date(
    Math.max(slotTime.getTime(), getNextCandidateMinute(now).getTime()),
  );
  const executionDayEnd = new Date(slotTime);
  executionDayEnd.setHours(23, 59, 0, 0);
  return queueStart.getTime() <= executionDayEnd.getTime();
}

function getAvailableNoTimeExecutorRecoveryDate(
  message: ScheduleHealthMessage,
  messages: ScheduleHealthMessage[],
  now: Date,
): string {
  const searchStart = new Date(now);
  searchStart.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const candidateDate = addDays(searchStart, dayOffset);
    const dateStr = formatLocalScheduleDate(candidateDate);
    if (!hasNoTimeExecutorRunWindow(message, dateStr, now)) {
      continue;
    }

    const candidateMessage: ScheduleHealthMessage = {
      ...message,
      Schedule_Date: dateStr,
      Schedule_Time: '',
    };
    const pressure = getScheduleQueuePressure(
      messages as ScheduledMessage[],
      candidateMessage as ScheduledMessage,
      now,
    );

    if (!pressure?.exceedsExecutionWindow) {
      return dateStr;
    }
  }

  return formatLocalScheduleDate(addDays(searchStart, 1));
}

function buildNoTimeExecutorRecoverySuggestion(
  message: ScheduleHealthMessage,
  messages: ScheduleHealthMessage[],
  now: Date,
): ScheduleHealthRecoverySuggestion {
  const dateStr = getAvailableNoTimeExecutorRecoveryDate(
    message,
    messages,
    now,
  );
  const today = formatLocalScheduleDate(now);
  return {
    dateStr,
    timeStr: '',
    label: `${dateStr} ${getDefaultScheduleTimeLabel(message)}`,
    clearsScheduleTime: true,
    reason:
      dateStr === today
        ? '改到今天的执行器默认队列，下一轮 Jira Automation 轮询会继续处理。'
        : '今天默认队列已没有可执行分钟，改到下一个可用执行器默认队列日。',
  };
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
  if (!hasMissedMinuteWindow(nextDate, now, allowedLagMinutes)) {
    return null;
  }

  return {
    code: 'missed_execution',
    messageId: message.ID,
    topic: message.Topic || message.ID,
    nextExecution,
    isExecutorDriven,
    summary: isExecutorDriven ? '已超过 30 分钟补偿窗口' : '执行时间已过',
    action: getMissedExecutionAction(message, isExecutorDriven),
  };
}

export function getScheduleHealthIssues(
  messages: ScheduleHealthMessage[],
  now = new Date(),
): ScheduleHealthIssue[] {
  return messages
    .map((message) => getScheduleHealthIssue(message, now))
    .filter((issue): issue is ScheduleHealthIssue => Boolean(issue));
}

export function getScheduleHealthRecoverySuggestion(
  message: ScheduleHealthMessage,
  now = new Date(),
): ScheduleHealthRecoverySuggestion | null {
  const issue = getScheduleHealthIssue(message, now);
  if (!issue) {
    return null;
  }

  if (issue.code === 'invalid_time' || hasExplicitScheduleTime(message)) {
    return buildExplicitRecoverySuggestion(
      now,
      issue.code === 'invalid_time'
        ? '把异常时间改成下一分钟的明确本地时间。'
        : '把已错过的明确时间改成下一分钟，恢复到可执行窗口内。',
    );
  }

  const isExecutorDriven = isExecutorDrivenSchedule({
    Push_Method: message.Push_Method,
    AI_Endpoint: message.AI_Endpoint,
  });

  if (isExecutorDriven) {
    return buildNoTimeExecutorRecoverySuggestion(message, [message], now);
  }

  const dateStr = getNextDefaultScheduleDate(message, now);
  return {
    dateStr,
    timeStr: '',
    label: `${dateStr} ${getDefaultScheduleTimeLabel(message)}`,
    clearsScheduleTime: true,
    reason: '保留默认发送时间，并把执行日期移到下一个仍可发送的日期。',
  };
}

export function getScheduleHealthRecoverySuggestions(
  messages: ScheduleHealthMessage[],
  now = new Date(),
): Map<string, ScheduleHealthRecoverySuggestion> {
  const issues = getScheduleHealthIssues(messages, now);
  const issueIds = new Set(issues.map((issue) => issue.messageId));
  const messagesById = new Map(
    messages.map((message) => [message.ID, message]),
  );
  const suggestions = new Map<string, ScheduleHealthRecoverySuggestion>();
  const reservedExplicitMinutes = getFutureExplicitReservationKeys(
    messages,
    issueIds,
    now,
  );
  const workingMessages = messages.map((message) => ({ ...message }));
  let explicitCursor = getNextCandidateMinute(now);

  for (const issue of issues) {
    const message = messagesById.get(issue.messageId);
    if (!message) {
      continue;
    }

    if (needsExplicitRecoverySuggestion(message, issue)) {
      while (reservedExplicitMinutes.has(getMinuteKey(explicitCursor))) {
        explicitCursor = addMinutes(explicitCursor, 1);
      }

      suggestions.set(
        issue.messageId,
        buildExplicitRecoverySuggestionAt(
          explicitCursor,
          getExplicitRecoveryReason(issue),
        ),
      );
      reservedExplicitMinutes.add(getMinuteKey(explicitCursor));
      const workingMessage = workingMessages.find(
        (candidate) => candidate.ID === issue.messageId,
      );
      if (workingMessage) {
        const { dateStr, timeStr } = suggestions.get(issue.messageId)!;
        workingMessage.Schedule_Date = dateStr;
        workingMessage.Schedule_Time = timeStr;
      }
      explicitCursor = addMinutes(explicitCursor, 1);
      continue;
    }

    const isExecutorDriven = isExecutorDrivenSchedule({
      Push_Method: message.Push_Method,
      AI_Endpoint: message.AI_Endpoint,
    });
    const suggestion = isExecutorDriven
      ? buildNoTimeExecutorRecoverySuggestion(message, workingMessages, now)
      : getScheduleHealthRecoverySuggestion(message, now);
    if (suggestion) {
      suggestions.set(issue.messageId, suggestion);
      const workingMessage = workingMessages.find(
        (candidate) => candidate.ID === issue.messageId,
      );
      if (workingMessage) {
        workingMessage.Schedule_Date = suggestion.dateStr;
        workingMessage.Schedule_Time = suggestion.timeStr;
      }
    }
  }

  return suggestions;
}

export function formatScheduleHealthIssue(issue: ScheduleHealthIssue): string {
  const nextLabel = issue.nextExecution ? `${issue.nextExecution} · ` : '';
  return `${nextLabel}${issue.summary}，${issue.action}`;
}

export function formatScheduleHealthSummary(
  issues: ScheduleHealthIssue[],
): string {
  const invalidCount = issues.filter(
    (issue) => issue.code === 'invalid_time',
  ).length;
  const missedCount = issues.filter(
    (issue) => issue.code === 'missed_execution',
  ).length;
  const parts = [`${issues.length} 条 Active 定时消息需要处理`];

  if (missedCount > 0) {
    parts.push(`${missedCount} 条已错过执行窗口`);
  }

  if (invalidCount > 0) {
    parts.push(`${invalidCount} 条时间格式异常`);
  }

  return parts.join('；');
}
