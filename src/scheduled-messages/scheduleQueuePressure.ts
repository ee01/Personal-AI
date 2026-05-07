import type { ScheduledMessage } from './types';
import { isValidLocalScheduleTime } from './scheduleDateTime.js';
import { calculateScheduledMessageNextExecution } from './scheduleNextExecution.js';

const COMPENSATION_WINDOW_MINUTES = 30;

export interface ScheduleQueuePressure {
  slotKey: string;
  slotSize: number;
  position: number;
  delayMinutes: number;
  elapsedCompensationMinutes: number;
  remainingCompensationMinutes: number;
  hasExplicitTime: boolean;
  exceedsCompensationWindow: boolean;
}

function isExecutorDrivenMessage(message: Pick<ScheduledMessage, 'Push_Method' | 'AI_Endpoint'>): boolean {
  return message.Push_Method === 'Bot' ||
    message.Push_Method === 'AI' ||
    (message.Push_Method === 'JiraAutomation' && Boolean(message.AI_Endpoint));
}

function hasExplicitScheduleTime(message: Pick<ScheduledMessage, 'Schedule_Time'>): boolean {
  return Boolean(message.Schedule_Time && message.Schedule_Time.trim());
}

function getScheduleSlotKey(message: ScheduledMessage): string {
  if (message.Status !== 'Active') {
    return '';
  }

  if (!isExecutorDrivenMessage(message)) {
    return '';
  }

  if (message.Automation_Link && !message.Schedule_Date) {
    return '';
  }

  if (hasExplicitScheduleTime(message) && !isValidLocalScheduleTime(message.Schedule_Time)) {
    return '';
  }

  return calculateScheduledMessageNextExecution(message);
}

function getExecutionDateFromSlotKey(slotKey: string): string {
  return slotKey.slice(0, 10);
}

function parseScheduleSlotKey(slotKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(slotKey);
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

function getElapsedCompensationMinutes(slotKey: string, now: Date): number {
  const slotTime = parseScheduleSlotKey(slotKey);
  if (!slotTime) {
    return 0;
  }

  const elapsedMs = now.getTime() - slotTime.getTime();
  if (elapsedMs <= 0) {
    return 0;
  }

  return Math.floor(elapsedMs / 60000);
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

export function getScheduleQueuePressure(
  messages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  now = new Date(),
): ScheduleQueuePressure | null {
  const targetSlotKey = getScheduleSlotKey(targetMessage);
  if (!targetSlotKey) {
    return null;
  }

  let sawTarget = false;
  const messagesWithTarget = messages.map((message) => {
    if (message.ID && targetMessage.ID && message.ID === targetMessage.ID) {
      sawTarget = true;
      return targetMessage;
    }
    return message;
  });

  if (!sawTarget) {
    messagesWithTarget.push(targetMessage);
  }

  const targetExecutionDate = getExecutionDateFromSlotKey(targetSlotKey);
  const sameSlotMessages = messagesWithTarget.filter(
    (message) => (
      getScheduleSlotKey(message) === targetSlotKey &&
      !isTerminalExecutionForDate(message, targetExecutionDate)
    ),
  );

  if (sameSlotMessages.length <= 1) {
    return null;
  }

  const position = sameSlotMessages.findIndex((message) => (
    message.ID && targetMessage.ID
      ? message.ID === targetMessage.ID
      : message === targetMessage
  )) + 1;

  if (position <= 0) {
    return null;
  }

  const delayMinutes = position - 1;
  const hasExplicitTime = hasExplicitScheduleTime(targetMessage);
  const elapsedCompensationMinutes = hasExplicitTime
    ? getElapsedCompensationMinutes(targetSlotKey, now)
    : 0;
  const remainingCompensationMinutes = hasExplicitTime
    ? Math.max(0, COMPENSATION_WINDOW_MINUTES - elapsedCompensationMinutes)
    : 0;

  return {
    slotKey: targetSlotKey,
    slotSize: sameSlotMessages.length,
    position,
    delayMinutes,
    elapsedCompensationMinutes,
    remainingCompensationMinutes,
    hasExplicitTime,
    exceedsCompensationWindow: hasExplicitTime &&
      elapsedCompensationMinutes + delayMinutes > COMPENSATION_WINDOW_MINUTES,
  };
}

export function formatScheduleQueuePressure(pressure: ScheduleQueuePressure): string {
  const queueLabel = pressure.hasExplicitTime
    ? `同执行时间第 ${pressure.position}/${pressure.slotSize} 个`
    : `08:00 后队列第 ${pressure.position}/${pressure.slotSize} 个`;
  const delayLabel = pressure.delayMinutes > 0
    ? `预计延后 ${pressure.delayMinutes} 分钟`
    : '优先执行';
  const remainingWindowLabel = pressure.hasExplicitTime && pressure.elapsedCompensationMinutes > 0
    ? `补偿窗口剩余 ${pressure.remainingCompensationMinutes} 分钟`
    : '';
  const riskLabel = pressure.exceedsCompensationWindow
    ? '可能超过 30 分钟补偿窗口'
    : '';

  return [queueLabel, delayLabel, remainingWindowLabel, riskLabel].filter(Boolean).join('，');
}

export function formatScheduleQueueBlockReason(pressure: ScheduleQueuePressure): string {
  if (!pressure.exceedsCompensationWindow) {
    return '';
  }

  return [
    `当前同一执行时间排在第 ${pressure.position}/${pressure.slotSize} 个`,
    `预计延后 ${pressure.delayMinutes} 分钟`,
    pressure.elapsedCompensationMinutes > 0
      ? `补偿窗口仅剩 ${pressure.remainingCompensationMinutes} 分钟`
      : '',
    '无法在 30 分钟补偿窗口内执行',
    '请改成未来时间，或清空执行时间进入 08:00 后队列。',
  ].filter(Boolean).join('，');
}
