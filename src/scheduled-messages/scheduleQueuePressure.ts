import type { ScheduledMessage } from './types';
import {
  formatLocalScheduleDate,
  formatLocalScheduleDateTime,
  hasLocalScheduleTime,
  isValidLocalScheduleTime,
  parseLocalScheduleTime,
} from './scheduleDateTime.js';
import {
  calculateScheduledMessageNextExecution,
  getDefaultScheduleTime,
  getDefaultScheduleTimeLabel,
  isExecutorDrivenSchedule,
} from './scheduleNextExecution.js';

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
  remainingSameDaySlots?: number;
  reservedExplicitMinutes?: number;
  exceedsExecutionWindow?: boolean;
}

export interface ScheduleQueueSuggestion {
  dateStr: string;
  timeStr: string;
  label: string;
  inspectedMinutes: number;
  clearsScheduleTime?: boolean;
}

export interface ScheduleQueueSlotSummary {
  slotKey: string;
  slotSize: number;
  maxDelayMinutes: number;
  elapsedCompensationMinutes: number;
  remainingCompensationMinutes: number;
  hasExplicitTime: boolean;
  exceedsCompensationWindow: boolean;
  remainingSameDaySlots?: number;
  reservedExplicitMinutes?: number;
  exceedsExecutionWindow?: boolean;
  messageIds: string[];
  sampleTopics: string[];
  actionMessageId: string;
  actionTopic: string;
  actionPosition: number;
  blockingCount: number;
  blockingTopics: string[];
  suggestion: ScheduleQueueSuggestion | null;
}

export interface ScheduleQueueSummary {
  congestedSlotCount: number;
  queuedMessageCount: number;
  riskSlotCount: number;
  largestSlotSize: number;
  maxDelayMinutes: number;
  hiddenSlotCount: number;
  topSlots: ScheduleQueueSlotSummary[];
}

type ScheduleQueueMode = 'explicit-time' | 'no-time';

interface NoTimeQueueSameDayCapacity {
  availableSlots: number;
  reservedExplicitMinutes: number;
}

function isExecutorDrivenMessage(message: Pick<ScheduledMessage, 'Push_Method' | 'AI_Endpoint'>): boolean {
  return isExecutorDrivenSchedule(message);
}

function hasExplicitScheduleTime(message: Pick<ScheduledMessage, 'Schedule_Time'>): boolean {
  return hasLocalScheduleTime(message.Schedule_Time);
}

function getScheduleSlotKey(message: ScheduledMessage, now = new Date()): string {
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

  return calculateScheduledMessageNextExecution(message, now);
}

function getScheduleQueueMode(message: ScheduledMessage, now = new Date()): ScheduleQueueMode | '' {
  const slotKey = getScheduleSlotKey(message, now);
  if (!slotKey) {
    return '';
  }

  return hasExplicitScheduleTime(message) ? 'explicit-time' : 'no-time';
}

function getScheduleQueueGroupKey(message: ScheduledMessage, now = new Date()): string {
  const slotKey = getScheduleSlotKey(message, now);
  const mode = slotKey ? getScheduleQueueMode(message, now) : '';
  return slotKey && mode ? `${mode}:${slotKey}` : '';
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

function getNoTimeQueueSameDayCapacity(
  slotKey: string,
  messages: ScheduledMessage[],
  now: Date,
): NoTimeQueueSameDayCapacity {
  const slotTime = parseScheduleSlotKey(slotKey);
  if (!slotTime) {
    return {
      availableSlots: 0,
      reservedExplicitMinutes: 0,
    };
  }

  const queueStart = new Date(Math.max(slotTime.getTime(), getNextCandidateMinute(now).getTime()));
  const executionDayEnd = new Date(slotTime);
  executionDayEnd.setHours(23, 59, 0, 0);

  if (queueStart.getTime() > executionDayEnd.getTime()) {
    return {
      availableSlots: 0,
      reservedExplicitMinutes: 0,
    };
  }

  const reservedExplicitSlotKeys = getReservedExplicitSlotKeys(messages, now);
  let availableSlots = 0;
  let reservedExplicitMinutes = 0;
  for (
    let cursor = new Date(queueStart);
    cursor.getTime() <= executionDayEnd.getTime();
    cursor = addMinutes(cursor, 1)
  ) {
    const { dateStr, timeStr } = formatLocalScheduleDateTime(cursor);
    if (reservedExplicitSlotKeys.has(`${dateStr} ${timeStr}`)) {
      reservedExplicitMinutes += 1;
      continue;
    }

    availableSlots += 1;
  }

  return {
    availableSlots,
    reservedExplicitMinutes,
  };
}

function hasScheduleQueueExecutionRisk(
  input: Pick<ScheduleQueuePressure | ScheduleQueueSlotSummary, 'exceedsCompensationWindow' | 'exceedsExecutionWindow'>,
): boolean {
  return Boolean(input.exceedsCompensationWindow || input.exceedsExecutionWindow);
}

function isExpiredExplicitSlot(slotKey: string, slotMessages: ScheduledMessage[], now: Date): boolean {
  return slotMessages.some(hasExplicitScheduleTime) &&
    getElapsedCompensationMinutes(slotKey, now) > COMPENSATION_WINDOW_MINUTES;
}

function isStaleNoTimeExecutorSlot(
  slotKey: string,
  message: Pick<ScheduledMessage, 'Schedule_Time'>,
  now: Date,
): boolean {
  if (hasExplicitScheduleTime(message)) {
    return false;
  }

  const executionDate = getExecutionDateFromSlotKey(slotKey);
  if (!executionDate) {
    return false;
  }

  return executionDate < formatLocalScheduleDate(now);
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
  allMessages: ScheduledMessage[],
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
  const actionMessage = slotMessages[slotMessages.length - 1];
  const exceedsCompensationWindow = hasExplicitTime &&
    elapsedCompensationMinutes + maxDelayMinutes > COMPENSATION_WINDOW_MINUTES;
  const sameDayCapacity = hasExplicitTime
    ? undefined
    : getNoTimeQueueSameDayCapacity(slotKey, allMessages, now);
  const remainingSameDaySlots = sameDayCapacity?.availableSlots;
  const reservedExplicitMinutes = sameDayCapacity?.reservedExplicitMinutes;
  const exceedsExecutionWindow = !hasExplicitTime &&
    typeof remainingSameDaySlots === 'number' &&
    maxDelayMinutes >= remainingSameDaySlots;
  const suggestion = actionMessage && maxDelayMinutes > 0 && (hasExplicitTime || exceedsExecutionWindow)
    ? getScheduleQueueSuggestion(allMessages, actionMessage, now)
    : null;
  const blockingMessages = actionMessage ? slotMessages.slice(0, -1) : [];

  return {
    slotKey,
    slotSize: slotMessages.length,
    maxDelayMinutes,
    elapsedCompensationMinutes,
    remainingCompensationMinutes,
    hasExplicitTime,
    exceedsCompensationWindow,
    ...(exceedsExecutionWindow ? {
      remainingSameDaySlots,
      ...(reservedExplicitMinutes ? { reservedExplicitMinutes } : {}),
      exceedsExecutionWindow,
    } : {}),
    messageIds: slotMessages.map(message => message.ID).filter(Boolean),
    sampleTopics: slotMessages
      .slice(0, 3)
      .map(message => message.Topic || message.ID)
      .filter(Boolean),
    actionMessageId: actionMessage?.ID || '',
    actionTopic: actionMessage?.Topic || actionMessage?.ID || '',
    actionPosition: slotMessages.length,
    blockingCount: blockingMessages.length,
    blockingTopics: blockingMessages
      .slice(0, 3)
      .map(message => message.Topic || message.ID)
      .filter(Boolean),
    suggestion,
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

    const slotKey = getScheduleSlotKey(message, now);
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
  for (const [slotKey, slotMessages] of Array.from(explicitSlots.entries())) {
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

function getReservedExplicitSlotKeys(messages: ScheduledMessage[], now: Date): Set<string> {
  const reservedMinuteKeys = getReservedExplicitMinuteKeys(messages, now);
  const reservedSlotKeys = new Set<string>();

  for (const minuteKey of Array.from(reservedMinuteKeys)) {
    const { dateStr, timeStr } = formatLocalScheduleDateTime(new Date(minuteKey * 60000));
    reservedSlotKeys.add(`${dateStr} ${timeStr}`);
  }

  return reservedSlotKeys;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function getEndOfExecutionDay(slotTime: Date): Date {
  const executionDayEnd = new Date(slotTime);
  executionDayEnd.setHours(23, 59, 0, 0);
  return executionDayEnd;
}

function getReservedExecutorMinuteKeys(messages: ScheduledMessage[], now: Date): Set<number> {
  const reservedMinuteKeys = getReservedExplicitMinuteKeys(messages, now);
  const noTimeSlots = new Map<string, { slotKey: string; messages: ScheduledMessage[] }>();
  const nextCandidateMinute = getNextCandidateMinute(now);

  for (const message of messages) {
    if (hasExplicitScheduleTime(message)) {
      continue;
    }

    const slotKey = getScheduleSlotKey(message, now);
    if (!slotKey || isStaleNoTimeExecutorSlot(slotKey, message, now)) {
      continue;
    }

    const executionDate = getExecutionDateFromSlotKey(slotKey);
    if (isTerminalExecutionForDate(message, executionDate)) {
      continue;
    }

    const groupKey = getScheduleQueueGroupKey(message, now);
    if (!groupKey) {
      continue;
    }

    const slot = noTimeSlots.get(groupKey) || { slotKey, messages: [] };
    slot.messages.push(message);
    noTimeSlots.set(groupKey, slot);
  }

  const sortedNoTimeSlots = Array.from(noTimeSlots.values()).sort((left, right) => (
    left.slotKey.localeCompare(right.slotKey)
  ));

  for (const { slotKey, messages: slotMessages } of sortedNoTimeSlots) {
    const slotTime = parseScheduleSlotKey(slotKey);
    if (!slotTime) {
      continue;
    }

    let cursor = new Date(Math.max(slotTime.getTime(), nextCandidateMinute.getTime()));
    const executionDayEnd = getEndOfExecutionDay(slotTime);

    for (let index = 0; index < slotMessages.length; index++) {
      while (
        cursor.getTime() <= executionDayEnd.getTime() &&
        reservedMinuteKeys.has(getMinuteKey(cursor))
      ) {
        cursor = addMinutes(cursor, 1);
      }

      if (cursor.getTime() > executionDayEnd.getTime()) {
        break;
      }

      reservedMinuteKeys.add(getMinuteKey(cursor));
      cursor = addMinutes(cursor, 1);
    }
  }

  return reservedMinuteKeys;
}

function getNoTimeOverflowSearchStart(
  targetSlotTime: Date,
  targetMessage: ScheduledMessage,
  now: Date,
): Date {
  const { hours, minutes } = parseLocalScheduleTime(getDefaultScheduleTime(targetMessage));
  const searchStart = new Date(targetSlotTime);
  searchStart.setDate(searchStart.getDate() + 1);
  searchStart.setHours(hours, minutes, 0, 0);

  const nextCandidateMinute = getNextCandidateMinute(now);
  while (searchStart.getTime() < nextCandidateMinute.getTime()) {
    searchStart.setDate(searchStart.getDate() + 1);
  }

  return searchStart;
}

function formatNoTimeQueueSuggestionLabel(
  dateStr: string,
  targetMessage: ScheduledMessage,
): string {
  const defaultTimeLabel = getDefaultScheduleTimeLabel(targetMessage);
  const queueLabel = defaultTimeLabel.endsWith('后')
    ? `${defaultTimeLabel}队列`
    : defaultTimeLabel;
  return `${dateStr} ${queueLabel}`;
}

function canNoTimeQueueMessageFitOnExecutionDate(
  existingMessages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  now: Date,
): boolean {
  const targetSlotKey = getScheduleSlotKey(targetMessage, now);
  if (!targetSlotKey) {
    return false;
  }

  const targetGroupKey = getScheduleQueueGroupKey(targetMessage, now);
  if (!targetGroupKey) {
    return false;
  }

  const messagesWithTarget = [...existingMessages, targetMessage];
  const targetExecutionDate = getExecutionDateFromSlotKey(targetSlotKey);
  const sameSlotMessages = messagesWithTarget.filter(message => (
    getScheduleQueueGroupKey(message, now) === targetGroupKey &&
    !isTerminalExecutionForDate(message, targetExecutionDate)
  ));
  const position = sameSlotMessages.findIndex(message => isSameMessage(message, targetMessage)) + 1;
  if (position <= 0) {
    return false;
  }

  const capacity = getNoTimeQueueSameDayCapacity(targetSlotKey, messagesWithTarget, now);
  return position <= capacity.availableSlots;
}

function getNoTimeOverflowQueueSuggestion(
  existingMessages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  targetSlotTime: Date,
  now: Date,
  searchMinutes: number,
): ScheduleQueueSuggestion | null {
  const searchStart = getNoTimeOverflowSearchStart(targetSlotTime, targetMessage, now);
  const maxSearchDays = Math.max(0, Math.ceil(searchMinutes / (24 * 60)));

  for (let dayOffset = 0; dayOffset <= maxSearchDays; dayOffset++) {
    const candidateTime = new Date(searchStart);
    candidateTime.setDate(searchStart.getDate() + dayOffset);
    const dateStr = formatLocalScheduleDate(candidateTime);
    const candidateMessage: ScheduledMessage = {
      ...targetMessage,
      Schedule_Date: dateStr,
      Schedule_Time: '',
    };
    const candidateSlotKey = getScheduleSlotKey(candidateMessage, now);
    if (!candidateSlotKey) {
      continue;
    }

    if (!canNoTimeQueueMessageFitOnExecutionDate(existingMessages, candidateMessage, now)) {
      continue;
    }

    return {
      dateStr,
      timeStr: '',
      label: formatNoTimeQueueSuggestionLabel(dateStr, targetMessage),
      inspectedMinutes: dayOffset + 1,
      clearsScheduleTime: true,
    };
  }

  return null;
}

export function getScheduleQueueSummary(
  messages: ScheduledMessage[],
  now = new Date(),
  limit = 3,
): ScheduleQueueSummary | null {
  const slots = new Map<string, { slotKey: string; messages: ScheduledMessage[] }>();

  for (const message of messages) {
    const slotKey = getScheduleSlotKey(message, now);
    if (!slotKey) {
      continue;
    }

    if (isStaleNoTimeExecutorSlot(slotKey, message, now)) {
      continue;
    }

    const executionDate = getExecutionDateFromSlotKey(slotKey);
    if (isTerminalExecutionForDate(message, executionDate)) {
      continue;
    }

    const groupKey = getScheduleQueueGroupKey(message, now);
    if (!groupKey) {
      continue;
    }

    const slot = slots.get(groupKey) || { slotKey, messages: [] };
    slot.messages.push(message);
    slots.set(groupKey, slot);
  }

  const congestedSlots = Array.from(slots.values())
    .filter(({ slotKey, messages: slotMessages }) => (
      slotMessages.length > 1 &&
      !isExpiredExplicitSlot(slotKey, slotMessages, now)
    ))
    .map(({ slotKey, messages: slotMessages }) => buildSlotSummary(slotKey, slotMessages, messages, now))
    .sort((left, right) => {
      const leftHasRisk = hasScheduleQueueExecutionRisk(left);
      const rightHasRisk = hasScheduleQueueExecutionRisk(right);
      if (leftHasRisk !== rightHasRisk) {
        return leftHasRisk ? -1 : 1;
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
    riskSlotCount: congestedSlots.filter(hasScheduleQueueExecutionRisk).length,
    largestSlotSize,
    maxDelayMinutes,
    hiddenSlotCount: Math.max(0, congestedSlots.length - Math.max(0, limit)),
    topSlots: congestedSlots.slice(0, Math.max(0, limit)),
  };
}

export function getScheduleQueuePressure(
  messages: ScheduledMessage[],
  targetMessage: ScheduledMessage,
  now = new Date(),
): ScheduleQueuePressure | null {
  const targetSlotKey = getScheduleSlotKey(targetMessage, now);
  if (!targetSlotKey) {
    return null;
  }
  if (isStaleNoTimeExecutorSlot(targetSlotKey, targetMessage, now)) {
    return null;
  }
  const targetGroupKey = getScheduleQueueGroupKey(targetMessage, now);
  if (!targetGroupKey) {
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
      getScheduleQueueGroupKey(message, now) === targetGroupKey &&
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
  const sameDayCapacity = hasExplicitTime
    ? undefined
    : getNoTimeQueueSameDayCapacity(targetSlotKey, messagesWithTarget, now);
  const remainingSameDaySlots = sameDayCapacity?.availableSlots;
  const reservedExplicitMinutes = sameDayCapacity?.reservedExplicitMinutes;
  const exceedsExecutionWindow = !hasExplicitTime &&
    typeof remainingSameDaySlots === 'number' &&
    delayMinutes >= remainingSameDaySlots;

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
    ...(exceedsExecutionWindow ? {
      remainingSameDaySlots,
      ...(reservedExplicitMinutes ? { reservedExplicitMinutes } : {}),
      exceedsExecutionWindow,
    } : {}),
  };
}

export function hasScheduleQueueBlockingRisk(
  pressure: ScheduleQueuePressure | null | undefined,
): boolean {
  return Boolean(pressure && hasScheduleQueueExecutionRisk(pressure));
}

export function hasScheduleQueueSlotRisk(
  slot: ScheduleQueueSlotSummary,
): boolean {
  return hasScheduleQueueExecutionRisk(slot);
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

  const targetHasExplicitTime = hasExplicitScheduleTime(targetMessage);
  if (targetHasExplicitTime && !isValidLocalScheduleTime(targetMessage.Schedule_Time)) {
    return null;
  }

  const targetPressure = getScheduleQueuePressure(messages, targetMessage, now);
  if (!targetPressure) {
    return null;
  }

  if (!targetHasExplicitTime && !targetPressure.exceedsExecutionWindow) {
    return null;
  }

  const targetSlotKey = getScheduleSlotKey(targetMessage, now);
  const targetSlotTime = parseScheduleSlotKey(targetSlotKey);
  if (!targetSlotTime) {
    return null;
  }

  const existingMessages = messages.filter(message => !isSameMessage(message, targetMessage));

  if (!targetHasExplicitTime && targetPressure.exceedsExecutionWindow) {
    return getNoTimeOverflowQueueSuggestion(
      existingMessages,
      targetMessage,
      targetSlotTime,
      now,
      searchMinutes,
    );
  }

  const reservedMinuteKeys = getReservedExecutorMinuteKeys(existingMessages, now);
  const searchStart = new Date(Math.max(targetSlotTime.getTime(), getNextCandidateMinute(now).getTime()));
  const targetExecutionDate = getExecutionDateFromSlotKey(targetSlotKey);
  const targetGroupKey = getScheduleQueueGroupKey(targetMessage, now);
  const existingTargetSlotCount = existingMessages.filter(message => (
    getScheduleQueueGroupKey(message, now) === targetGroupKey &&
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
    const candidateSlotKey = getScheduleSlotKey(candidateMessage, now);
    if (!candidateSlotKey) {
      continue;
    }

    const pressure = getScheduleQueuePressure(existingMessages, candidateMessage, now);
    if (pressure) {
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
    : pressure.exceedsExecutionWindow
      ? '可能排到执行日期结束后'
      : '';

  return [queueLabel, delayLabel, remainingWindowLabel, riskLabel].filter(Boolean).join('，');
}

export function formatScheduleQueueSuggestion(suggestion: ScheduleQueueSuggestion): string {
  if (suggestion.clearsScheduleTime) {
    return `建议改到 ${suggestion.label}，保留未填写执行时间的队列语义。`;
  }

  return `建议改到 ${suggestion.label}，避开当前拥挤时间槽。`;
}

export function formatScheduleQueueBlockReason(pressure: ScheduleQueuePressure): string {
  if (!hasScheduleQueueBlockingRisk(pressure)) {
    return '';
  }

  if (pressure.exceedsExecutionWindow && !pressure.hasExplicitTime) {
    return [
      `当前 08:00 后队列排在第 ${pressure.position}/${pressure.slotSize} 个`,
      `预计延后 ${pressure.delayMinutes} 分钟`,
      typeof pressure.remainingSameDaySlots === 'number'
        ? `当天剩余可执行约 ${pressure.remainingSameDaySlots} 条`
        : '',
      pressure.reservedExplicitMinutes
        ? `已避开 ${pressure.reservedExplicitMinutes} 个明确时间分钟`
        : '',
      '可能排到执行日期结束后',
      '请改成未来日期，或填写明确时间。',
    ].filter(Boolean).join('，');
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
    : slot.exceedsExecutionWindow
      ? '可能排到执行日期结束后'
      : '';
  const remainingWindowLabel = slot.exceedsExecutionWindow && typeof slot.remainingSameDaySlots === 'number'
    ? [
      `当天剩余可执行约 ${slot.remainingSameDaySlots} 条`,
      slot.reservedExplicitMinutes
        ? `已扣除 ${slot.reservedExplicitMinutes} 个明确时间分钟`
        : '',
    ].filter(Boolean).join('，')
    : '';
  const sampleLabel = slot.sampleTopics.length > 0
    ? `示例：${slot.sampleTopics.join('、')}`
    : '';
  const actionLabel = slot.actionTopic
    ? `建议处理：${slot.actionTopic}（第 ${slot.actionPosition}/${slot.slotSize} 个）`
    : '';
  const blockingLabel = slot.blockingCount > 0
    ? `前面 ${slot.blockingCount} 条待执行${slot.blockingTopics.length > 0 ? `：${slot.blockingTopics.join('、')}` : ''}`
    : '';
  const suggestionLabel = slot.suggestion
    ? `建议改到 ${slot.suggestion.label}`
    : '';

  return [
    `${slotLabel}: ${slot.slotSize} 条`,
    delayLabel,
    riskLabel,
    remainingWindowLabel,
    actionLabel,
    blockingLabel,
    suggestionLabel,
    sampleLabel,
  ].filter(Boolean).join('，');
}

export function formatScheduleQueueSummary(summary: ScheduleQueueSummary): string {
  const riskLabel = summary.riskSlotCount > 0
    ? `${summary.riskSlotCount} 个时间槽存在执行窗口风险`
    : '暂无执行窗口风险';

  return [
    `${summary.congestedSlotCount} 个时间槽同时排队`,
    `${summary.queuedMessageCount} 条执行器消息受影响`,
    `最大同槽 ${summary.largestSlotSize} 条`,
    `最大预计延后 ${summary.maxDelayMinutes} 分钟`,
    riskLabel,
  ].join('；');
}
