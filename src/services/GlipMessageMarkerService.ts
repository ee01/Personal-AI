import type { TopicItemWithAutoReply } from '../message-reaction/AutoReplyHandler';
import { isOpenSnoozeReminder } from '../message-reaction/snoozeDeduplication.js';
import type {
  PushLog,
  PushMethod,
  ScheduledMessage,
} from '../scheduled-messages/types';
import type {
  GlipMessageMarker,
  GlipMessageMarkerType,
} from './MemoryServiceClient';

export const GLIP_MESSAGE_MARKERS_KEY = 'glipMessageMarkers';

export interface GlipMessageMarkerCache {
  version: 1;
  updatedAt: number;
  markersByChatId: Record<string, Record<string, GlipMessageMarker[]>>;
}

const MARKER_PRIORITY: Record<GlipMessageMarkerType, number> = {
  outreach_initial_ask: 10,
  snooze_pending: 15,
  outreach_followup: 20,
  scheduled_asme: 30,
  scheduled_ai_report: 31,
  scheduled_bot: 32,
  follow_thread_original: 40,
  follow_thread_related: 50,
};

function normalizeId(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function clampText(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function isManualConcernedItem(
  item: TopicItemWithAutoReply & { source?: string },
): boolean {
  if (item?.source && item.source !== 'manual') return false;
  if (typeof item?.id === 'string' && item.id.startsWith('outreach:')) {
    return false;
  }
  return true;
}

function extractRingCentralMessageRef(
  value: unknown,
): { chatId: string; postId: string; messageUrl: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.match(
    /https:\/\/app\.ringcentral\.com\/messages\/([^/\s)\]]+)\/([^/\s)\]]+)/,
  );
  if (!match?.[1] || !match[2]) return null;
  return {
    chatId: match[1],
    postId: match[2],
    messageUrl: match[0],
  };
}

function getScheduledMessageTimeLabel(message: ScheduledMessage): string {
  return [message.Schedule_Date, message.Schedule_Time]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

function makeMarkerIndex(
  markers: GlipMessageMarker[],
): GlipMessageMarkerCache['markersByChatId'] {
  const index: GlipMessageMarkerCache['markersByChatId'] = {};
  for (const marker of markers) {
    const chatId = normalizeId(marker.chatId);
    const postId = normalizeId(marker.postId);
    if (!chatId || !postId) continue;

    const nextMarker: GlipMessageMarker = {
      ...marker,
      chatId,
      postId,
      updatedAt: Number.isFinite(marker.updatedAt)
        ? marker.updatedAt
        : Math.floor(Date.now() / 1000),
    };
    index[chatId] ??= {};
    index[chatId][postId] ??= [];
    const existingIndex = index[chatId][postId].findIndex(
      (item) => item.id === nextMarker.id,
    );
    if (existingIndex >= 0) {
      index[chatId][postId][existingIndex] = nextMarker;
    } else {
      index[chatId][postId].push(nextMarker);
    }
  }

  Object.values(index).forEach((posts) => {
    Object.values(posts).forEach((items) => {
      items.sort(
        (left, right) =>
          (MARKER_PRIORITY[left.type] ?? 100) -
            (MARKER_PRIORITY[right.type] ?? 100) ||
          right.updatedAt - left.updatedAt,
      );
    });
  });

  return index;
}

function flattenIndex(
  index: GlipMessageMarkerCache['markersByChatId'],
): GlipMessageMarker[] {
  return Object.values(index).flatMap((posts) => Object.values(posts).flat());
}

export function mergeMarkerIndexes(
  ...indexes: Array<GlipMessageMarkerCache['markersByChatId'] | undefined>
): GlipMessageMarkerCache['markersByChatId'] {
  return makeMarkerIndex(
    indexes.flatMap((index) => (index ? flattenIndex(index) : [])),
  );
}

export function buildFollowThreadMarkers(
  items: TopicItemWithAutoReply[] = [],
): GlipMessageMarkerCache['markersByChatId'] {
  const markers: GlipMessageMarker[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  items
    .filter((item) => isManualConcernedItem(item))
    .filter((item) => item.followThread && item.followConfig)
    .forEach((item) => {
      const original = item.followConfig?.originalMessage;
      const chatId = normalizeId(original?.teamId);
      const postId = normalizeId(original?.postId);
      if (!chatId || !postId || !original) return;

      const expiredAtMs =
        typeof item.expiredAt === 'number' ? item.expiredAt : undefined;
      const expiresInDays =
        expiredAtMs && expiredAtMs > Date.now()
          ? Math.ceil((expiredAtMs - Date.now()) / 86400000)
          : undefined;

      markers.push({
        id: `follow-thread-original:${item.id}:${chatId}:${postId}`,
        type: 'follow_thread_original',
        label: '关注后续',
        chatId,
        postId,
        source: 'local',
        sourceId: item.id,
        updatedAt: nowSeconds,
        tooltip: clampText((item as any).summary || original.content),
        metadata: {
          sender: original.sender,
          teamName: original.teamName,
          messageUrl: original.messageUrl,
          expiresInDays,
          relatedCount: item.followConfig?.relatedMessages?.length ?? 0,
        },
      });

      (item.followConfig?.relatedMessages ?? []).forEach((related) => {
        const relatedPostId = normalizeId(related.postId);
        if (!relatedPostId) return;
        markers.push({
          id: `follow-thread-related:${item.id}:${chatId}:${relatedPostId}`,
          type: 'follow_thread_related',
          label: '关联',
          chatId,
          postId: relatedPostId,
          source: 'local',
          sourceId: item.id,
          updatedAt: nowSeconds,
          tooltip: clampText(related.summary),
          metadata: {
            sender: related.sender,
            relationType: related.relationType,
            originalPostId: postId,
            originalSender: original.sender,
            messageUrl: original.messageUrl,
          },
        });
      });
    });

  return makeMarkerIndex(markers);
}

function getScheduledMarkerPresentation(pushMethod: PushMethod | string): {
  type: GlipMessageMarkerType;
  label: string;
} | null {
  switch (pushMethod) {
    case 'AsMe':
      return { type: 'scheduled_asme', label: 'AI代发' };
    case 'Bot':
      return { type: 'scheduled_bot', label: 'AI推送' };
    case 'AI':
    case 'JiraAutomation':
      return { type: 'scheduled_ai_report', label: 'AI报告' };
    default:
      return null;
  }
}

export function buildScheduledPushLogMarkers(
  logs: PushLog[] = [],
): GlipMessageMarkerCache['markersByChatId'] {
  const markers: GlipMessageMarker[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  logs
    .filter((log) => log.Status === 'Success')
    .forEach((log) => {
      const presentation = getScheduledMarkerPresentation(log.Push_Method);
      if (!presentation) return;

      const chatId = normalizeId(log.Sent_Chat_ID);
      const postId = normalizeId(log.Sent_Post_ID);
      if (!chatId || !postId) return;

      const sentAt = normalizeId(log.Sent_At) ?? normalizeId(log.Timestamp);
      const parsedSentAt = sentAt ? Date.parse(sentAt) : Number.NaN;
      const sourceId =
        normalizeId(log.Execution_Key) ?? normalizeId(log.Message_ID) ?? postId;
      markers.push({
        id: `scheduled-log:${presentation.type}:${sourceId}:${chatId}:${postId}`,
        type: presentation.type,
        label: presentation.label,
        chatId,
        postId,
        source: 'sheet',
        sourceId,
        updatedAt: Number.isFinite(parsedSentAt)
          ? Math.floor(parsedSentAt / 1000)
          : nowSeconds,
        tooltip: clampText(log.Topic || log.Content),
        metadata: {
          messageId: log.Message_ID,
          pushMethod: log.Push_Method,
          topic: log.Topic,
          executionKey: log.Execution_Key,
          sentAt,
        },
      });
    });

  return makeMarkerIndex(markers);
}

export function buildScheduledSnoozeMarkers(
  messages: ScheduledMessage[] = [],
): GlipMessageMarkerCache['markersByChatId'] {
  const markers: GlipMessageMarker[] = [];
  const nowSeconds = Math.floor(Date.now() / 1000);

  messages.filter(isOpenSnoozeReminder).forEach((message) => {
    const sourceRef = extractRingCentralMessageRef(message.Content);
    if (!sourceRef) return;

    const remindAt = getScheduledMessageTimeLabel(message);
    const tooltipParts = [
      remindAt ? `提醒时间：${remindAt}` : '',
      clampText(message.Topic || message.Content, 120) || '',
    ].filter(Boolean);

    markers.push({
      id: `snooze-pending:${message.ID}:${sourceRef.chatId}:${sourceRef.postId}`,
      type: 'snooze_pending',
      label: '稍后处理',
      chatId: sourceRef.chatId,
      postId: sourceRef.postId,
      source: 'sheet',
      sourceId: message.ID,
      updatedAt: nowSeconds,
      tooltip: tooltipParts.join(' · ') || undefined,
      metadata: {
        messageId: message.ID,
        topic: message.Topic,
        scheduleDate: message.Schedule_Date,
        scheduleTime: message.Schedule_Time,
        status: message.Status,
        messageUrl: sourceRef.messageUrl,
      },
    });
  });

  return makeMarkerIndex(markers);
}

export async function writeGlipMessageMarkersCache(
  markersByChatId: GlipMessageMarkerCache['markersByChatId'],
): Promise<GlipMessageMarkerCache> {
  const cache: GlipMessageMarkerCache = {
    version: 1,
    updatedAt: Date.now(),
    markersByChatId,
  };
  await chrome.storage.local.set({ [GLIP_MESSAGE_MARKERS_KEY]: cache });
  return cache;
}
