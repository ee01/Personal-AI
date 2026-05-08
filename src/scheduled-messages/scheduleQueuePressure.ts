import type { ScheduledMessage } from './types';
import { formatLocalScheduleDateTime, isValidLocalScheduleTime } from './scheduleDateTime.js';
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

export interface ScheduleQueueSlotSummary {
  slotKey: string;
  slotSize: number;
  maxDelayMinutes: number;
  elapsedCompensationMinutes: number;
  remainingCompensationMinutes: number;
  hasExplicitTime: boolean;
  exceedsCompensationWindow: boolean;
  messageIds: string[];
  sampleTopics: string[];
}

export interface ScheduleQueueSummary {
  congestedSlotCount: number;
  queuedMessageCount: number;
  riskSlotCount: number;
  largestSlotSize: number;
  maxDelayMinutes: number;
  topSlots: ScheduleQueueSlotSummary[];
}

export interface ScheduleQueueSuggestion {
  dateStr: string;
  timeStr: string;
  label: string;
  inspectedMinutes: number;
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

function isExpiredExplicitSlot(slotKey: string, slotMessages: ScheduledMessage[], now: Date): boolean {
  return slotMessages.some(hasExplicitScheduleTime) &&
    getElapsedCompensationMinutes(slotKey, now) > COMPENSATION_WINDOW_MINUTES;
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

function buildSlotSummary(
  slotKey: string,
  slotMessages: ScheduledMessage[],
  now: Date,
): ScheduleQueueSlotSummary {
  const hasExplicitTime = slotMessages.some(hasExplicitScheduleTime);
  const elapsedCompensationMinutes = hasExplicitTime
    ? getElapsedCompensationMinutes(slotKey, now)
    : 0;
  const remainingCompensationMinutes = hasExplicitTime
    ? Math.max(0, COMPENSATION_WINDOW_MINUTES - elapsedCompensationMinutes)
    : 0;
  const maxDelayMinutes = Math.max(0, slotMessages.length - 1);

  return {
    slotKey,
    slotSize: slotMessages.length,
    maxDelayMinutes,
    elapsedCompensationMinutes,
    remainingCompensationMinutes,
    hasExplicitTime,
    exceedsCompensationWindow: hasExplicitTime &&
      elapsedCompensationMinutes + maxDelayMinutes > COMPENSATION_WINDOW_MINUTES,
    messageIds: slotMessages.map(message => message.ID).filter(Boolean),
    sampleTopics: slotMessages
      .slice(0, 3)
      .map(message => message.Topic || message.ID)
      .filter(Boolean),
  };
}

function isSameMessage(left: ScheduledMessage, right: ScheduledMessage): boolean {
  return Boolean(left.ID && right.ID && left.ID === right.ID);
}

function getNextCandidateMinute(now: Date): Date {
  const date = new Date(now);
  date.setSeconds(0, 0);
  if (date.getTime() <= now.getTime()) {
    date.setMinutes(date.getMinutes() + 1);
  }
  return date;
}

function getMinuteKey(date: Date): number {
  return Math.floor(date.getTime() / 60000);
}

function getReservedExplicitMinuteKeys(messages: ScheduledMessage[], now: Date): Set<number> {
  const explicitSlots = new Map<string, ScheduledMessage[]>();
  const nextCandidateMinute = getNextCandidateMinute(now);

  for (const message of messages) {
    if (!hasExplicitScheduleTime(message)) {
      continue;
    }

    const slotKey = getScheduleSlotKey(message);
    if (!slotKey) {
      continue;
    }

    const executionDate = getExecutionDateFromSlotKey(slotKey);
    if (isTerminalExecutionForDate(message, executionDate)) {
      continue;
    }

    const slotMessages = explicitSlots.get(slotKey) || [];
    slotMessages.push(message);
    explicitSlots.set(slotKey, slotMessages);
  }

  const reservedMinuteKeys = new Set<number>();
  for (const [slotKey, slotMessages] of explicitSlots.entries()) {
    if (isExpiredExplicitSlot(slotKey, slotMessages, now)) {
      continue;
    }

    const slotTime = parseScheduleSlotKey(slotKey);
    if (!slotTime) {
      continue;
    }

    const reservationStartMs = Math.max(slotTime.getTime(), nextCandidateMinute.getTime());
    for (let index = 0; index < slotMessages.length; index++) {
      reservedMinuteKeys.add(getMinuteKey(new Date(reservationStartMs + index * 60000)));
    }
  }

  return reservedMinuteKeys;
}

export function getScheduleQueueSummary(
  messages: ScheduledMessage[],
  now = new Date(),
  limit = 3,
): ScheduleQueueSummary | null {
  const slots = new Map<string, ScheduledMessage[]>();

  for (const message of messages) {
    const slotKey = getScheduleSlotKey(message);
    if (!slotKey) {
      continue;
    }

    const executionDate = getExecutionDateFromSlotKey(slotKey);
    if (isTerminalExecutionForDate(message, executionDate)) {
      continue;
    }

    const slotMessages = slots.get(slotKey) || [];
    slotMessages.push(message);
    slots.set(slotKey, slotMessages);
  }

  const congestedSlots = Array.from(slots.entries())
    .filter(([slotKey, slotMessages]) => (
      slotMessages.length > 1 &&
      !isExpiredExplicitSlot(slotKey, slotMessages, now)
    ))
    .map(([slotKey, slotMessages]) => buildSlotSummary(slotKey, slotMessages, now))
    .sort((left, right) => {
      if (left.exceedsCompensationWindow !== right.exceedsCompensationWindow) {
        return left.exceedsCompensationWindow ? -1 : 1;
      }

      if (left.maxDelayMinutes !== right.maxDelayMinutes) {
        return right.maxDelayMinutes - left.maxDelayMinutes;
      }

      return left.slotKey.localeCompare(right.slotKey);
    });

  if (congestedSlots.length === 0) {
    return null;
  }

  const largestSlotSize = Math.max(...congestedSlots.map(slot => slot.slotSize));
  const maxDelayMinutes = Math.max(...congestedSlots.map(slot => slot.maxDelayMinutes));

  return {
    congestedSlotCount: congestedSlots.length,
    queuedMessageCount: congestedSlots.reduce((sum, slot) => sum + slot.slotSize, 0),
    riskSlotCount: congestedSlots.filter(slot => slot.exceedsCompensationWindow).length,
    largestSlotSize,
    maxDelayMinutes,
    topSlots: congestedSlots.slice(0, Math.max(0, limit)),
  };
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

export function getScheduleQueueSuggestion(
  messages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  now = new Date(),
  searchMinutes = 24 * 60,
): ScheduleQueueSuggestion | null {
  if (!isExecutorDrivenMessage(targetMessage) || !targetMessage.Schedule_Date) {
    return null;
  }

  if (!hasExplicitScheduleTime(targetMessage) || !isValidLocalScheduleTime(targetMessage.Schedule_Time)) {
    return null;
  }

  const targetSlotKey = getScheduleSlotKey(targetMessage);
  const targetSlotTime = parseScheduleSlotKey(targetSlotKey);
  if (!targetSlotTime) {
    return null;
  }

  const existingMessages = messages.filter(message => !isSameMessage(message, targetMessage));
  const reservedMinuteKeys = getReservedExplicitMinuteKeys(existingMessages, now);
  const searchStart = new Date(Math.max(targetSlotTime.getTime(), getNextCandidateMinute(now).getTime()));
  const targetExecutionDate = getExecutionDateFromSlotKey(targetSlotKey);
  const existingTargetSlotCount = existingMessages.filter(message => (
    getScheduleSlotKey(message) === targetSlotKey &&
    !isTerminalExecutionForDate(message, targetExecutionDate)
  )).length;
  const targetSlotReservationEndMs = targetSlotTime.getTime() + existingTargetSlotCount * 60000;

  for (let offset = 0; offset <= searchMinutes; offset++) {
    const candidateTime = new Date(searchStart.getTime() + offset * 60000);
    if (candidateTime.getTime() < targetSlotReservationEndMs) {
      continue;
    }

    if (reservedMinuteKeys.has(getMinuteKey(candidateTime))) {
      continue;
    }

    const { dateStr, timeStr } = formatLocalScheduleDateTime(candidateTime);
    const candidateMessage: ScheduledMessage = {
      ...targetMessage,
      Schedule_Date: dateStr,
      Schedule_Time: timeStr,
    };
    const pressure = getScheduleQueuePressure(existingMessages, candidateMessage, now);
    if (pressure?.exceedsCompensationWindow) {
      continue;
    }

    return {
      dateStr,
      timeStr,
      label: `${dateStr} ${timeStr}`,
      inspectedMinutes: offset + 1,
    };
  }

  return null;
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

export function formatScheduleQueueSuggestion(suggestion: ScheduleQueueSuggestion): string {
  return `建议改到 ${suggestion.label}，避开当前拥挤时间槽。`;
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

export function formatScheduleQueueSlotSummary(slot: ScheduleQueueSlotSummary): string {
  const slotLabel = slot.hasExplicitTime ? slot.slotKey : `${slot.slotKey} 后队列`;
  const delayLabel = slot.maxDelayMinutes > 0
    ? `最大预计延后 ${slot.maxDelayMinutes} 分钟`
    : '优先执行';
  const riskLabel = slot.exceedsCompensationWindow
    ? '可能超过 30 分钟补偿窗口'
    : '';
  const sampleLabel = slot.sampleTopics.length > 0
    ? `示例：${slot.sampleTopics.join('、')}`
    : '';

  return [
    `${slotLabel}: ${slot.slotSize} 条`,
    delayLabel,
    riskLabel,
    sampleLabel,
  ].filter(Boolean).join('，');
}

export function formatScheduleQueueSummary(summary: ScheduleQueueSummary): string {
  const riskLabel = summary.riskSlotCount > 0
    ? `${summary.riskSlotCount} 个时间槽可能超过 30 分钟补偿窗口`
    : '暂无超出补偿窗口的时间槽';

  return [
    `${summary.congestedSlotCount} 个时间槽同时排队`,
    `${summary.queuedMessageCount} 条 Bot/AI 消息受影响`,
    `最大同槽 ${summary.largestSlotSize} 条`,
    `最大预计延后 ${summary.maxDelayMinutes} 分钟`,
    riskLabel,
  ].join('；');
}
