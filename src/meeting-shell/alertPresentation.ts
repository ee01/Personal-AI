import type { MeetingPilotAlert } from './protocol';

type MeetingPilotAlertCandidate = Pick<
  MeetingPilotAlert,
  'level' | 'title' | 'body' | 'source'
>;

function normalizeAlertText(value?: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isContextOnlyMeetingPilotAlert(
  alert: MeetingPilotAlertCandidate,
): boolean {
  if (
    alert.level === 'P0' ||
    alert.source === 'mention' ||
    alert.source === 'action'
  ) {
    return false;
  }

  const title = normalizeAlertText(alert.title);
  const body = normalizeAlertText(alert.body);
  const combined = `${title} ${body}`;

  if (
    /(?:当前|current)\s*(?:主讲人?|speaker)\s*(?:切换|更新|变化|changed|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /(?:主讲人?|speaker)\s*(?:切换|更新|变化)/i.test(combined)
  ) {
    return true;
  }

  if (
    /(?:正在主讲|is speaking|speaking now).*(?:上下文|context).*(?:刷新|更新|切换|refresh|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /(?:对话上下文|会议上下文|meeting context|conversation context).*(?:刷新|更新|切换|refresh|updated|switch(?:ed)?)/i.test(
      combined,
    ) ||
    /meeting pilot\s*(?:已|has)?\s*(?:切换|switched).*(?:上下文|context)/i.test(
      combined,
    )
  ) {
    return true;
  }

  return false;
}

export function shouldSurfaceMeetingPilotAlert(
  alert: MeetingPilotAlertCandidate,
): boolean {
  return !isContextOnlyMeetingPilotAlert(alert);
}
