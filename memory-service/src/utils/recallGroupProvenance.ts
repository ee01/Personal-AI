import type { RecallItem } from '../types/index.js';

const GROUP_METADATA_KEYS = [
  'groupName',
  'group_name',
  'conversationTitle',
  'conversation_title',
  'chatTitle',
  'chat_title',
  'threadTitle',
  'thread_title',
  'currentGroup',
  'current_group',
] as const;

const CHAT_LIKE_SOURCES = new Set(['glip', 'ringcentral']);
const MEETING_LIKE_SOURCE_PATTERN = /meeting/i;

function normalizeGroupLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function stripMeetingMemorySuffix(value: string): string {
  return value
    .replace(/\s+(?:—|-)\s+Meeting Memory$/i, '')
    .replace(/\s+(?:—|-)\s+Meeting$/i, '')
    .trim();
}

function isMemoStyleTitle(value: string | undefined): boolean {
  if (!value) return false;
  return /^(meeting\s+)?memo\b|会议纪要|会议记录|meeting\s+notes?/i.test(value.trim());
}

function pickChatLikeFallback(item: RecallItem): string | undefined {
  const metadata = item.metadata ?? {};
  const sourceTitle = normalizeGroupLabel(item.sourceTitle ?? metadata.sourceTitle);
  const displayTitle = normalizeGroupLabel(item.displayTitle);

  if (sourceTitle && !isMemoStyleTitle(sourceTitle)) {
    return sourceTitle;
  }
  if (displayTitle && !isMemoStyleTitle(displayTitle)) {
    return displayTitle;
  }
  return undefined;
}

/**
 * Resolve the chat/group a recalled item came from. Primary path is
 * messages_raw.group_name (mirrored into metadata.groupName at ingest/recall).
 * When that column is empty, fall back to other provenance fields or, for chat
 * and meeting memories, the best available conversation title.
 */
export function resolveRecallGroupProvenance(item: RecallItem): string | undefined {
  const metadata = item.metadata ?? {};
  for (const key of GROUP_METADATA_KEYS) {
    const resolved = normalizeGroupLabel(metadata[key]);
    if (resolved) return resolved;
  }

  const source = (item.source || '').toLowerCase();
  if (CHAT_LIKE_SOURCES.has(source)) {
    return pickChatLikeFallback(item);
  }
  if (MEETING_LIKE_SOURCE_PATTERN.test(source)) {
    const title = normalizeGroupLabel(item.sourceTitle ?? item.displayTitle);
    if (title) return stripMeetingMemorySuffix(title);
  }

  return undefined;
}

/** Ensure response.evidence carries groupName when we can infer it. */
export function enrichRecallItemGroupProvenance(item: RecallItem): RecallItem {
  const resolved = resolveRecallGroupProvenance(item);
  if (!resolved) return item;

  const metadata = { ...(item.metadata ?? {}) };
  if (!normalizeGroupLabel(metadata.groupName)) {
    metadata.groupName = resolved;
  }
  if (!normalizeGroupLabel(metadata.group_name)) {
    metadata.group_name = resolved;
  }
  return { ...item, metadata };
}

export function enrichRecallItemsGroupProvenance(items: RecallItem[]): RecallItem[] {
  return items.map(enrichRecallItemGroupProvenance);
}
