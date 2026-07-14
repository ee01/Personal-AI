import type {
  MeetingPilotMemoryRef,
  MeetingPilotSessionSnapshot,
} from './protocol';
import { shouldSurfaceMeetingPilotAlert } from './alertPresentation.js';

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

export type MeetingPilotLiveFeedReceipt = {
  surfacedAlertCount: number;
  surfacedP0AlertCount: number;
  filteredContextAlertCount: number;
  promotedMemoryCount: number;
  feedMemoryCount: number;
  hiddenMemoryCount: number;
  summary: string;
  boundary: string;
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

export function getSurfacedMeetingPilotAlerts(
  session: MeetingPilotSessionSnapshot,
): MeetingPilotSessionSnapshot['alerts'] {
  return session.alerts.filter(
    (alert) => !alert.resolved && shouldSurfaceMeetingPilotAlert(alert),
  );
}

export function buildMeetingPilotLiveFeedReceipt(
  session: MeetingPilotSessionSnapshot,
  promotedMemoryRefs: MeetingPilotMemoryRef[] = getVisibleMeetingMemoryCueRefs(
    session.memoryRefs,
  ),
): MeetingPilotLiveFeedReceipt {
  const unresolvedAlerts = session.alerts.filter((alert) => !alert.resolved);
  const surfacedAlerts = getSurfacedMeetingPilotAlerts(session);
  const displayableMemoryRefs = session.memoryRefs.filter(
    isMeetingMemoryRefDisplayable,
  );
  const promotedMemoryIds = new Set(
    promotedMemoryRefs.map((ref) => ref.id).filter(Boolean),
  );
  const feedMemoryCount = displayableMemoryRefs.filter(
    (ref) => !promotedMemoryIds.has(ref.id),
  ).length;
  const filteredContextAlertCount = Math.max(
    0,
    unresolvedAlerts.length - surfacedAlerts.length,
  );
  const hiddenMemoryCount = Math.max(
    0,
    session.memoryRefs.length - displayableMemoryRefs.length,
  );
  const parts = [
    `显示 ${surfacedAlerts.length} 条可操作会中提醒`,
  ];

  if (filteredContextAlertCount) {
    parts.push(`降噪 ${filteredContextAlertCount} 条纯上下文刷新`);
  } else {
    parts.push('暂无被降噪的上下文刷新');
  }

  if (promotedMemoryRefs.length) {
    parts.push(`顶部已提升 ${promotedMemoryRefs.length} 条关联记忆`);
  }

  if (feedMemoryCount) {
    parts.push(`提醒流保留 ${feedMemoryCount} 条关联记忆`);
  }

  if (hiddenMemoryCount) {
    parts.push(`隐藏 ${hiddenMemoryCount} 条缺少解释线索或已标记隐藏的记忆`);
  }

  return {
    surfacedAlertCount: surfacedAlerts.length,
    surfacedP0AlertCount: surfacedAlerts.filter(
      (alert) => alert.level === 'P0',
    ).length,
    filteredContextAlertCount,
    promotedMemoryCount: promotedMemoryRefs.length,
    feedMemoryCount,
    hiddenMemoryCount,
    summary: `${parts.join('；')}。`,
    boundary:
      '这是当前页面可见切片，不是全量会议审计；不会标记提醒已处理、写行动项、发送消息或外发纪要。',
  };
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
  const alertItems: MeetingPilotLiveFeedItem[] = getSurfacedMeetingPilotAlerts(
    session,
  ).map((alert) => ({
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
