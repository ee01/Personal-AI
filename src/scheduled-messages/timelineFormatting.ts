import type { ScheduledMessage } from './types';

type TimelineOffsetInput = ScheduledMessage['Timeline_Offset'] | string | null | undefined;

export function normalizeTimelineOffset(offset: TimelineOffsetInput): number {
  if (typeof offset === 'number' && Number.isFinite(offset)) {
    return offset;
  }

  if (typeof offset === 'string' && offset.trim()) {
    const parsedOffset = Number(offset);
    if (Number.isFinite(parsedOffset)) {
      return parsedOffset;
    }
  }

  return 0;
}

export function formatTimelineOffsetText(offset: TimelineOffsetInput): string {
  const normalizedOffset = normalizeTimelineOffset(offset);

  if (normalizedOffset === 0) {
    return '当天';
  }

  return normalizedOffset > 0
    ? `后${normalizedOffset}天`
    : `前${Math.abs(normalizedOffset)}天`;
}

export function formatTimelineNextExecutionText(
  message: Pick<ScheduledMessage, 'Timeline_Milestone' | 'Timeline_Offset'>
): string {
  return `${message.Timeline_Milestone} ${formatTimelineOffsetText(message.Timeline_Offset)}`;
}

export function formatTimelineFrequencyText(
  message: Pick<ScheduledMessage, 'Timeline_Milestone' | 'Timeline_Offset' | 'Schedule_Time'>
): string {
  const baseText = formatTimelineNextExecutionText(message);
  const scheduleTime = message.Schedule_Time?.trim();

  return scheduleTime ? `${baseText} ${scheduleTime}` : `${baseText}早上`;
}
