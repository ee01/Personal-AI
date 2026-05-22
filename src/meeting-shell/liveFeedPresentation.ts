import type {
  MeetingPilotMemoryRef,
  MeetingPilotSessionSnapshot,
} from './protocol';

export type MeetingPilotLiveFeedItem =
  | {
      kind: 'memory';
      id: string;
      createdAt: number;
      memory: MeetingPilotMemoryRef;
    }
  | {
      kind: 'alert';
      id: string;
      createdAt: number;
      alert: MeetingPilotSessionSnapshot['alerts'][number];
    };

export function normalizeMeetingFeedTimestamp(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

export function getVisibleMeetingMemoryCueRefs(
  memoryRefs: MeetingPilotMemoryRef[],
  limit = 3,
): MeetingPilotMemoryRef[] {
  return memoryRefs
    .filter(isMeetingMemoryRefDisplayable)
    .slice(0, limit);
}

export function buildMeetingPilotLiveFeedItems(
  session: MeetingPilotSessionSnapshot,
  promotedMemoryRefs: MeetingPilotMemoryRef[] = getVisibleMeetingMemoryCueRefs(
    session.memoryRefs,
  ),
): MeetingPilotLiveFeedItem[] {
  const promotedMemoryIds = new Set(
    promotedMemoryRefs.map((ref) => ref.id).filter(Boolean),
  );
  const memoryItems: MeetingPilotLiveFeedItem[] = session.memoryRefs
    .filter(isMeetingMemoryRefDisplayable)
    .filter((ref) => !promotedMemoryIds.has(ref.id))
    .map((ref) => ({
      kind: 'memory' as const,
      id: ref.id,
      createdAt: normalizeMeetingFeedTimestamp(ref.matchedAt || ref.timestamp),
      memory: ref,
    }));
  const alertItems: MeetingPilotLiveFeedItem[] = session.alerts
    .filter((alert) => !alert.resolved)
    .map((alert) => ({
      kind: 'alert' as const,
      id: alert.id,
      createdAt: normalizeMeetingFeedTimestamp(alert.createdAt),
      alert,
    }));

  return [...memoryItems, ...alertItems].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
}

function isMeetingMemoryRefDisplayable(ref: MeetingPilotMemoryRef): boolean {
  if (ref.displayPriority === 'hidden') return false;
  if (ref.whyRelevant?.some((item) => item.trim())) return true;
  return (
    ref.evidenceRole === 'action_item' ||
    ref.evidenceRole === 'action' ||
    ref.evidenceRole === 'decision' ||
    ref.evidenceRole === 'issue' ||
    ref.evidenceRole === 'risk'
  );
}
